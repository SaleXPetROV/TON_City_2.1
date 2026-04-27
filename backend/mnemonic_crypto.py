"""Crypto helpers for encrypting/decrypting wallet mnemonics at rest.

Uses Fernet (AES-128-CBC + HMAC-SHA256) from `cryptography` library.
Key is loaded from the MNEMONIC_ENC_KEY env var. If not set, the module
runs in passthrough mode — no encryption/decryption happens (safe default
for a migration window where old plaintext values remain readable).

Encrypted values are stored with a fixed prefix `enc::` so we can tell
them apart from legacy plaintext mnemonics on the fly.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_ENC_PREFIX = "enc::"
_fernet: Optional[Fernet] = None


def _get_fernet() -> Optional[Fernet]:
    """Return cached Fernet instance if MNEMONIC_ENC_KEY is configured."""
    global _fernet
    if _fernet is not None:
        return _fernet
    key = os.environ.get("MNEMONIC_ENC_KEY", "").strip()
    if not key:
        return None
    try:
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
        return _fernet
    except Exception as e:
        logger.error("Invalid MNEMONIC_ENC_KEY: %s", e)
        return None


def is_encrypted(value: Optional[str]) -> bool:
    return isinstance(value, str) and value.startswith(_ENC_PREFIX)


def encrypt_mnemonic(plain: Optional[str]) -> Optional[str]:
    """Encrypt a mnemonic string. Returns None/empty for falsy input.
    If already encrypted, returns as-is. If no key configured, returns plain
    unchanged (passthrough)."""
    if not plain:
        return plain
    if is_encrypted(plain):
        return plain
    f = _get_fernet()
    if f is None:
        return plain
    try:
        token = f.encrypt(plain.encode("utf-8")).decode("ascii")
        return _ENC_PREFIX + token
    except Exception as e:
        logger.error("encrypt_mnemonic failed: %s", e)
        return plain


def decrypt_mnemonic(value: Optional[str]) -> Optional[str]:
    """Decrypt an encrypted mnemonic. If the value isn't encrypted OR no
    key is configured, returns as-is (legacy/passthrough)."""
    if not value:
        return value
    if not is_encrypted(value):
        return value
    f = _get_fernet()
    if f is None:
        logger.warning("decrypt_mnemonic: value is encrypted but MNEMONIC_ENC_KEY is not set")
        return value
    try:
        token = value[len(_ENC_PREFIX):]
        return f.decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        logger.error("decrypt_mnemonic: invalid token (key mismatch or corruption)")
        return None
    except Exception as e:
        logger.error("decrypt_mnemonic failed: %s", e)
        return None


async def migrate_plaintext_to_encrypted(db) -> dict:
    """One-shot migration: find any plaintext mnemonic in admin_settings /
    admin_wallets and re-store it encrypted. Idempotent."""
    f = _get_fernet()
    if f is None:
        return {"status": "skipped", "reason": "MNEMONIC_ENC_KEY not configured"}

    stats = {"admin_settings": 0, "admin_wallets": 0}

    async for doc in db.admin_settings.find({"mnemonic": {"$exists": True, "$ne": ""}}):
        value = doc.get("mnemonic") or ""
        if is_encrypted(value):
            continue
        enc = encrypt_mnemonic(value)
        if enc and enc != value:
            await db.admin_settings.update_one(
                {"_id": doc["_id"]},
                {"$set": {"mnemonic": enc}}
            )
            stats["admin_settings"] += 1

    async for doc in db.admin_wallets.find({"mnemonic": {"$exists": True, "$ne": ""}}):
        value = doc.get("mnemonic") or ""
        if is_encrypted(value):
            continue
        enc = encrypt_mnemonic(value)
        if enc and enc != value:
            await db.admin_wallets.update_one(
                {"_id": doc["_id"]},
                {"$set": {"mnemonic": enc}}
            )
            stats["admin_wallets"] += 1

    stats["status"] = "done"
    return stats
