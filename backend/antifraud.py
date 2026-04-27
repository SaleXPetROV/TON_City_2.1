"""Anti-multi-accounting service (Turnstile + FingerprintJS edition).

Signals we collect on register/login/withdraw:
  • visitor_id  — FingerprintJS OSS (local device fingerprint, browser-side)
  • ip + UA     — derived from request headers (Kubernetes ingress)
  • turnstile   — Cloudflare Turnstile token verification (anti-bot)

All events are persisted into `fingerprints` MongoDB collection so the
admin panel can group users by visitor_id / IP and list failed Turnstile
challenges.

Turnstile runs in dry-run when TURNSTILE_SECRET_KEY env var is empty.
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_TIMEOUT = 6.0

_turnstile_lock = asyncio.Lock()


def _is_valid_ip(ip: str) -> bool:
    try:
        ipaddress.ip_address(ip)
        return True
    except Exception:
        return False


def get_client_ip(request: Request) -> str:
    """Extract real client IP from Kubernetes ingress headers."""
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        first = xff.split(",")[0].strip()
        if _is_valid_ip(first):
            return first
    xrip = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if xrip and _is_valid_ip(xrip):
        return xrip
    if request.client and request.client.host:
        return request.client.host
    return "0.0.0.0"


async def verify_turnstile(token: str, ip: Optional[str] = None) -> dict:
    """Verify a Cloudflare Turnstile token server-side.

    Returns a dict: {success, error_codes, hostname, action, cdata, dry_run}.
    In dry-run mode (no secret key) returns success=True with dry_run=True so
    callers can proceed.
    """
    secret = os.environ.get("TURNSTILE_SECRET_KEY", "").strip()
    if not secret:
        return {"success": True, "dry_run": True, "error_codes": []}

    if not token:
        return {"success": False, "dry_run": False, "error_codes": ["missing-input-response"]}

    data = {"secret": secret, "response": token}
    if ip and _is_valid_ip(ip):
        data["remoteip"] = ip

    try:
        async with _turnstile_lock:
            async with httpx.AsyncClient(timeout=TURNSTILE_TIMEOUT) as client:
                resp = await client.post(TURNSTILE_VERIFY_URL, data=data)
                resp.raise_for_status()
                payload = resp.json()
    except httpx.TimeoutException:
        logger.warning("Turnstile timeout")
        return {"success": False, "dry_run": False, "error_codes": ["timeout"]}
    except Exception as e:
        logger.warning("Turnstile verify error: %s", e)
        return {"success": False, "dry_run": False, "error_codes": ["internal-error"]}

    return {
        "success": bool(payload.get("success", False)),
        "dry_run": False,
        "error_codes": payload.get("error-codes", []) or [],
        "hostname": payload.get("hostname", "") or "",
        "action": payload.get("action", "") or "",
        "cdata": payload.get("cdata", "") or "",
        "challenge_ts": payload.get("challenge_ts", "") or "",
    }


async def record_event(
    db,
    *,
    event_type: str,
    request: Request,
    user: Optional[dict] = None,
    visitor_id: Optional[str] = None,
    turnstile: Optional[dict] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> dict:
    """Persist one anti-fraud event and return the stored document.

    event_type: "register" | "login" | "withdraw"
    """
    ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "")[:400]

    ts_success = bool(turnstile.get("success")) if turnstile else None
    ts_dry_run = bool(turnstile.get("dry_run")) if turnstile else None
    ts_errors = list(turnstile.get("error_codes", [])) if turnstile else []

    risk = "low"
    if turnstile is not None and turnstile.get("success") is False:
        risk = "high"

    now = datetime.now(timezone.utc)
    doc = {
        "event_type": event_type,
        "ip": ip,
        "user_agent": ua,
        "visitor_id": (visitor_id or "").strip() or None,
        "user_id": (user or {}).get("id"),
        "username": (user or {}).get("username"),
        "email": (user or {}).get("email"),
        "turnstile": {
            "success": ts_success,
            "dry_run": ts_dry_run,
            "error_codes": ts_errors,
            "hostname": (turnstile or {}).get("hostname", "") if turnstile else "",
        } if turnstile is not None else None,
        "risk": risk,
        "created_at": now,
        "extra": extra or {},
    }
    try:
        await db.fingerprints.insert_one(doc.copy())
    except Exception as e:
        logger.error("Failed to persist fingerprint event: %s", e)
    return doc


async def ensure_ttl_index(db, ttl_days: int = 30) -> None:
    """Ensure a TTL index on `created_at` so old anti-fraud events are
    automatically deleted by MongoDB after `ttl_days`. Idempotent —
    re-creates the index if ttl_days changes."""
    try:
        indexes = await db.fingerprints.index_information()
        existing = indexes.get("ttl_created_at")
        desired_seconds = ttl_days * 24 * 3600
        if existing and existing.get("expireAfterSeconds") != desired_seconds:
            try:
                await db.fingerprints.drop_index("ttl_created_at")
            except Exception:
                pass
            existing = None
        if not existing:
            await db.fingerprints.create_index(
                "created_at",
                expireAfterSeconds=desired_seconds,
                name="ttl_created_at",
            )
            logger.info("Fingerprints TTL index set to %s days", ttl_days)
    except Exception as e:
        logger.warning("Failed to create fingerprints TTL index: %s", e)


async def cleanup_events(
    db,
    *,
    mode: str = "older_than",
    older_than_days: Optional[int] = 30,
    event_ids: Optional[list] = None,
    failed_only: bool = False,
) -> dict:
    """Delete fingerprint events.

    mode:
      - "older_than": remove events where created_at < now - older_than_days
      - "failed_only": remove only Turnstile-failed events
      - "by_ids": remove specific events by their ObjectId
      - "all": wipe everything (use with care)
    """
    query: Dict[str, Any] = {}
    if mode == "older_than":
        cutoff = datetime.now(timezone.utc) - _td_days(older_than_days or 30)
        query = {"created_at": {"$lt": cutoff}}
    elif mode == "failed_only":
        query = {"turnstile.success": False}
    elif mode == "by_ids":
        from bson import ObjectId
        ids = []
        for raw in event_ids or []:
            try:
                ids.append(ObjectId(raw))
            except Exception:
                continue
        if not ids:
            return {"deleted": 0, "mode": mode}
        query = {"_id": {"$in": ids}}
    elif mode == "all":
        query = {}
    else:
        return {"deleted": 0, "mode": mode, "error": "unknown mode"}

    if failed_only and mode != "failed_only":
        query["turnstile.success"] = False

    result = await db.fingerprints.delete_many(query)
    return {"deleted": int(result.deleted_count), "mode": mode}


def _td_days(days: int):
    from datetime import timedelta
    return timedelta(days=days)


async def build_admin_report(db, limit: int = 100) -> dict:
    """Produce the aggregated report consumed by the admin panel."""

    # --- 1. Groups by visitor_id (device fingerprint) ---
    visitor_pipeline = [
        {"$match": {"visitor_id": {"$nin": [None, ""]}, "user_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$visitor_id",
                "users": {"$addToSet": {"user_id": "$user_id", "username": "$username", "email": "$email"}},
                "events_count": {"$sum": 1},
                "last_seen": {"$max": "$created_at"},
                "last_ip": {"$last": "$ip"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "visitor_id": "$_id",
                "users": 1,
                "events_count": 1,
                "last_seen": 1,
                "last_ip": 1,
                "unique_users": {"$size": "$users"},
            }
        },
        {"$match": {"unique_users": {"$gt": 1}}},
        {"$sort": {"unique_users": -1, "last_seen": -1}},
        {"$limit": limit},
    ]

    # --- 2. Groups by IP ---
    ip_pipeline = [
        {"$match": {"ip": {"$nin": [None, "", "0.0.0.0"]}, "user_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$ip",
                "users": {"$addToSet": {"user_id": "$user_id", "username": "$username", "email": "$email"}},
                "events_count": {"$sum": 1},
                "last_seen": {"$max": "$created_at"},
                "visitors": {"$addToSet": "$visitor_id"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "ip": "$_id",
                "users": 1,
                "events_count": 1,
                "last_seen": 1,
                "unique_users": {"$size": "$users"},
                "unique_visitors": {"$size": "$visitors"},
            }
        },
        {"$match": {"unique_users": {"$gt": 1}}},
        {"$sort": {"unique_users": -1, "last_seen": -1}},
        {"$limit": limit},
    ]

    # --- 3. Failed Turnstile challenges (bots) ---
    failed_challenges_pipeline = [
        {"$match": {"turnstile.success": False}},
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
        {
            "$project": {
                "_id": {"$toString": "$_id"},
                "event_type": 1,
                "ip": 1,
                "visitor_id": 1,
                "user_id": 1,
                "username": 1,
                "email": 1,
                "turnstile": 1,
                "created_at": 1,
            }
        },
    ]

    visitor_groups = await db.fingerprints.aggregate(visitor_pipeline).to_list(limit)
    ip_groups = await db.fingerprints.aggregate(ip_pipeline).to_list(limit)
    failed_challenges = await db.fingerprints.aggregate(failed_challenges_pipeline).to_list(limit)

    total_events = await db.fingerprints.count_documents({})
    turnstile_pass = await db.fingerprints.count_documents({"turnstile.success": True})
    turnstile_fail = await db.fingerprints.count_documents({"turnstile.success": False})

    def _jsonify(doc):
        if isinstance(doc, dict):
            return {k: _jsonify(v) for k, v in doc.items()}
        if isinstance(doc, list):
            return [_jsonify(x) for x in doc]
        if isinstance(doc, datetime):
            return doc.isoformat()
        return doc

    return {
        "turnstile_enabled": bool(os.environ.get("TURNSTILE_SECRET_KEY", "").strip()),
        "total_events": total_events,
        "turnstile_counters": {
            "passed": turnstile_pass,
            "failed": turnstile_fail,
        },
        "visitor_groups": _jsonify(visitor_groups),
        "ip_groups": _jsonify(ip_groups),
        "failed_challenges": _jsonify(failed_challenges),
        "totals": {
            "visitor_groups": len(visitor_groups),
            "ip_groups": len(ip_groups),
            "failed_challenges": len(failed_challenges),
        },
    }
