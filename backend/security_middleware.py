"""
Security middleware for TON City:
- Secure JWT secret generation (S1)
- Rate limiting via slowapi (S3)
- Login brute-force lockout — MongoDB-backed for multi-worker support (S3)
- Security headers with per-request CSP nonce (S7)
- Password strength validation (S4)
- Log sanitization (S6)
"""
import os
import re
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# ==================== S1: JWT SECRET ====================

def get_or_generate_jwt_secret() -> str:
    """Return JWT secret from env or generate a secure random one at startup."""
    secret = os.environ.get("JWT_SECRET_KEY", "").strip()
    legacy_default = "ton-city-builder-secret-key-2025"
    if not secret or secret == legacy_default:
        generated = secrets.token_urlsafe(48)
        logger.warning(
            "[SECURITY] JWT_SECRET_KEY not set or using legacy default. "
            "Generated a random secret for this process. "
            "Set JWT_SECRET_KEY in backend/.env for persistence across restarts."
        )
        os.environ["JWT_SECRET_KEY"] = generated
        return generated
    return secret


# ==================== S3: RATE LIMITING ====================

def _get_identifier(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)

limiter = Limiter(key_func=_get_identifier, default_limits=[])


# ==================== S3: BRUTE-FORCE LOCKOUT (MongoDB) ====================

# Shared DB handle — populated by server.py at startup.
_lockout_db = None
MAX_FAILED_ATTEMPTS = 10
LOCKOUT_MINUTES = 15
ATTEMPT_TTL_SECONDS = 30 * 60  # reset counter after 30 min of inactivity


def init_lockout_store(db) -> None:
    """Bind the Motor database + ensure indexes."""
    global _lockout_db
    _lockout_db = db
    # TTL index: Mongo auto-expires entries after ATTEMPT_TTL_SECONDS past last_attempt.
    # We don't do this in an await because init is called synchronously; asyncio
    # will handle the coroutine when the event loop runs the create_index lazily.
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        loop.create_task(_ensure_indexes())
    except RuntimeError:
        pass


async def _ensure_indexes() -> None:
    if _lockout_db is None:
        return
    try:
        await _lockout_db.login_attempts.create_index("key", unique=True)
        await _lockout_db.login_attempts.create_index(
            "last_attempt",
            expireAfterSeconds=ATTEMPT_TTL_SECONDS,
        )
    except Exception as e:
        logger.warning(f"[SECURITY] Failed to create login_attempts indexes: {e}")


def _key(email: str, ip: str) -> str:
    return f"{(email or '').lower()}|{ip}"


async def check_login_lockout_async(email: str, ip: str) -> None:
    """Raise 429 if user/IP is locked out."""
    if _lockout_db is None:
        return
    entry = await _lockout_db.login_attempts.find_one({"key": _key(email, ip)}, {"_id": 0})
    if not entry:
        return
    if entry.get("count", 0) >= MAX_FAILED_ATTEMPTS:
        locked_until = entry.get("locked_until")
        if locked_until:
            if isinstance(locked_until, str):
                try:
                    locked_until = datetime.fromisoformat(locked_until.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    locked_until = None
            if locked_until and locked_until > datetime.now(timezone.utc):
                remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Слишком много неудачных попыток входа. Попробуйте через {remaining} мин."
                )
            # Expired lockout — clear it
            await _lockout_db.login_attempts.delete_one({"key": _key(email, ip)})


async def record_login_failure_async(email: str, ip: str) -> None:
    """Increment failure counter, start lockout if threshold reached."""
    if _lockout_db is None:
        return
    k = _key(email, ip)
    now = datetime.now(timezone.utc)
    # Upsert + $inc
    await _lockout_db.login_attempts.update_one(
        {"key": k},
        {
            "$inc": {"count": 1},
            "$set": {"last_attempt": now},
            "$setOnInsert": {"first_attempt": now},
        },
        upsert=True,
    )
    entry = await _lockout_db.login_attempts.find_one({"key": k}, {"_id": 0})
    if entry and entry.get("count", 0) >= MAX_FAILED_ATTEMPTS and not entry.get("locked_until"):
        await _lockout_db.login_attempts.update_one(
            {"key": k},
            {"$set": {"locked_until": now + timedelta(minutes=LOCKOUT_MINUTES)}},
        )
        logger.warning(f"[SECURITY] Login lockout triggered for {k}")


async def record_login_success_async(email: str, ip: str) -> None:
    """Reset counter on successful login."""
    if _lockout_db is None:
        return
    await _lockout_db.login_attempts.delete_one({"key": _key(email, ip)})


# ===== Backwards-compatible sync wrappers =====
# auth_handler still calls sync versions; wrap them so they schedule onto the loop.
# These wrappers detect the running loop and await the coroutine.
import asyncio as _asyncio


def _run_async(coro):
    try:
        loop = _asyncio.get_running_loop()
    except RuntimeError:
        return _asyncio.run(coro)
    # Inside an already-running loop (FastAPI) — schedule and return
    return loop.create_task(coro)


def check_login_lockout(email: str, ip: str):
    # In async context the caller should await check_login_lockout_async directly.
    # Kept for backward compat — no-op when DB not initialised.
    if _lockout_db is None:
        return
    # We cannot raise from a scheduled task; caller should use async variant.
    # Returning coroutine lets auth_handler `await` it if needed.
    return check_login_lockout_async(email, ip)


def record_login_failure(email: str, ip: str):
    if _lockout_db is None:
        return
    return record_login_failure_async(email, ip)


def record_login_success(email: str, ip: str):
    if _lockout_db is None:
        return
    return record_login_success_async(email, ip)


# ==================== S4: PASSWORD STRENGTH ====================

PASSWORD_MIN_LEN = 8
_PW_LETTER_RE = re.compile(r"[A-Za-zА-Яа-я]")
_PW_DIGIT_RE = re.compile(r"\d")


def validate_password_strength(password: str) -> None:
    if not password or len(password) < PASSWORD_MIN_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Пароль должен содержать минимум {PASSWORD_MIN_LEN} символов"
        )
    if not _PW_LETTER_RE.search(password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать хотя бы одну букву")
    if not _PW_DIGIT_RE.search(password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать хотя бы одну цифру")


# ==================== S7: SECURITY HEADERS with CSP nonce ====================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers + per-request CSP nonce.

    The nonce is accessible via `request.state.csp_nonce` for any endpoint
    that renders HTML and wants to embed an inline <script> safely.
    """

    async def dispatch(self, request: Request, call_next):
        nonce = secrets.token_urlsafe(16)
        request.state.csp_nonce = nonce

        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=()"
        )
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains"
        )
        # Strict CSP with nonce for inline scripts (only ones with the matching
        # nonce attribute will execute). 'strict-dynamic' lets scripts loaded by
        # a nonced script also run, covering typical bootstrap patterns.
        csp = (
            "default-src 'self'; "
            f"script-src 'self' 'nonce-{nonce}' 'strict-dynamic'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers.setdefault("Content-Security-Policy", csp)
        # Expose the nonce so frontend-only pages (if any) can pull it at runtime
        response.headers.setdefault("X-CSP-Nonce", nonce)
        return response


# ==================== S6: LOG SANITIZATION ====================

_SENSITIVE_KEYS = {"password", "hashed_password", "token", "secret", "mnemonic", "private_key"}


def sanitize_for_log(obj):
    if isinstance(obj, dict):
        return {k: ("***" if k.lower() in _SENSITIVE_KEYS else sanitize_for_log(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_log(x) for x in obj]
    return obj
