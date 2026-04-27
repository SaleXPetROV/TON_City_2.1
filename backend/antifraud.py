"""Anti-multi-accounting service.

Collects per-event fingerprints (visitor_id from FingerprintJS OSS on the
client, server-side real IP, User-Agent) and, when an IPQualityScore API
key is configured, enriches the record with IP reputation data.

All events are persisted into the `fingerprints` MongoDB collection so the
admin panel can group users by IP / visitor_id / flagged IPQS signals.

When IPQS_API_KEY is empty the module silently runs in dry-run mode:
IP + visitor_id + UA are still saved, `ipqs` field is None, cache is not
used. This makes it safe to deploy before the user has obtained an API key.
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)

IPQS_BASE_URL = "https://www.ipqualityscore.com/api/json/ip"
IPQS_CACHE_TTL_SEC = 24 * 3600
IPQS_TIMEOUT = 8.0
_ipqs_cache: Dict[str, tuple[dict, float]] = {}
_ipqs_lock = asyncio.Lock()


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


async def _call_ipqs(api_key: str, ip: str) -> Optional[dict]:
    """Call IPQualityScore proxy detection API. Returns parsed JSON or None."""
    url = f"{IPQS_BASE_URL}/{api_key}/{ip}"
    params = {"strictness": 0, "allow_public_access_points": "true"}
    try:
        async with httpx.AsyncClient(timeout=IPQS_TIMEOUT) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            success = bool(data.get("success", True))
            if not success:
                logger.warning("IPQS non-success: %s", data.get("message"))
            return {
                "fraud_score": int(data.get("fraud_score", 0) or 0),
                "is_vpn": bool(data.get("vpn", False)),
                "is_proxy": bool(data.get("proxy", False)),
                "is_tor": bool(data.get("tor", False)),
                "is_crawler": bool(data.get("is_crawler", False)),
                "recent_abuse": bool(data.get("recent_abuse", False)),
                "country_code": data.get("country_code") or "",
                "region": data.get("region") or "",
                "city": data.get("city") or "",
                "isp": data.get("ISP") or data.get("isp") or "",
                "connection_type": data.get("connection_type") or "",
                "raw_success": success,
                "raw_message": data.get("message") or "",
            }
    except httpx.TimeoutException:
        logger.warning("IPQS timeout for %s", ip)
    except httpx.HTTPStatusError as e:
        logger.warning("IPQS HTTP %s for %s: %s", e.response.status_code, ip, e.response.text[:200])
    except Exception as e:
        logger.warning("IPQS error for %s: %s", ip, e)
    return None


async def check_ip_reputation(ip: str) -> Optional[dict]:
    """Public wrapper with 24h cache. Returns None in dry-run mode."""
    api_key = os.environ.get("IPQS_API_KEY", "").strip()
    if not api_key or not _is_valid_ip(ip):
        return None
    async with _ipqs_lock:
        entry = _ipqs_cache.get(ip)
        now = time.time()
        if entry and entry[1] > now:
            return entry[0]
    data = await _call_ipqs(api_key, ip)
    if data is not None:
        async with _ipqs_lock:
            _ipqs_cache[ip] = (data, time.time() + IPQS_CACHE_TTL_SEC)
    return data


def _risk_level(ipqs: Optional[dict]) -> str:
    if not ipqs:
        return "unknown"
    score = ipqs.get("fraud_score", 0)
    if ipqs.get("is_tor"):
        return "critical"
    if score >= 85 or ipqs.get("recent_abuse"):
        return "high"
    if score >= 75 or ipqs.get("is_vpn") or ipqs.get("is_proxy"):
        return "medium"
    return "low"


async def record_event(
    db,
    *,
    event_type: str,
    request: Request,
    user: Optional[dict] = None,
    visitor_id: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> dict:
    """Persist one anti-fraud event and return the stored document.

    event_type: "register" | "login" | "withdraw"
    user: user document (for denormalised fields)
    visitor_id: FingerprintJS OSS visitor id from the client
    """
    ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "")[:400]
    ipqs = await check_ip_reputation(ip)

    doc = {
        "event_type": event_type,
        "ip": ip,
        "user_agent": ua,
        "visitor_id": (visitor_id or "").strip() or None,
        "user_id": (user or {}).get("id"),
        "username": (user or {}).get("username"),
        "email": (user or {}).get("email"),
        "ipqs": ipqs,
        "risk": _risk_level(ipqs),
        "created_at": datetime.now(timezone.utc),
        "extra": extra or {},
    }
    try:
        await db.fingerprints.insert_one(doc.copy())
    except Exception as e:
        logger.error("Failed to persist fingerprint event: %s", e)
    return doc


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
                "max_fraud_score": {"$max": {"$ifNull": ["$ipqs.fraud_score", 0]}},
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
                "max_fraud_score": 1,
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
                "max_fraud_score": {"$max": {"$ifNull": ["$ipqs.fraud_score", 0]}},
                "any_vpn": {"$max": {"$cond": [{"$eq": ["$ipqs.is_vpn", True]}, 1, 0]}},
                "any_proxy": {"$max": {"$cond": [{"$eq": ["$ipqs.is_proxy", True]}, 1, 0]}},
                "any_tor": {"$max": {"$cond": [{"$eq": ["$ipqs.is_tor", True]}, 1, 0]}},
                "country_code": {"$last": "$ipqs.country_code"},
                "isp": {"$last": "$ipqs.isp"},
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
                "max_fraud_score": 1,
                "any_vpn": {"$gt": ["$any_vpn", 0]},
                "any_proxy": {"$gt": ["$any_proxy", 0]},
                "any_tor": {"$gt": ["$any_tor", 0]},
                "country_code": 1,
                "isp": 1,
            }
        },
        {"$match": {"unique_users": {"$gt": 1}}},
        {"$sort": {"unique_users": -1, "last_seen": -1}},
        {"$limit": limit},
    ]

    # --- 3. High-risk events (VPN / Tor / Proxy / fraud_score>=75) ---
    high_risk_pipeline = [
        {
            "$match": {
                "$or": [
                    {"ipqs.is_tor": True},
                    {"ipqs.is_vpn": True},
                    {"ipqs.is_proxy": True},
                    {"ipqs.fraud_score": {"$gte": 75}},
                ]
            }
        },
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "event_type": 1,
                "ip": 1,
                "visitor_id": 1,
                "user_id": 1,
                "username": 1,
                "email": 1,
                "ipqs": 1,
                "risk": 1,
                "created_at": 1,
            }
        },
    ]

    visitor_groups = await db.fingerprints.aggregate(visitor_pipeline).to_list(limit)
    ip_groups = await db.fingerprints.aggregate(ip_pipeline).to_list(limit)
    high_risk = await db.fingerprints.aggregate(high_risk_pipeline).to_list(limit)

    total_events = await db.fingerprints.count_documents({})

    # Check latest IPQS response to detect activation / credit issues
    last_ipqs_doc = await db.fingerprints.find_one(
        {"ipqs": {"$ne": None}},
        sort=[("created_at", -1)],
        projection={"ipqs.raw_success": 1, "ipqs.raw_message": 1, "created_at": 1},
    )
    ipqs_api_status = None
    if last_ipqs_doc and last_ipqs_doc.get("ipqs"):
        ipqs_api_status = {
            "success": bool(last_ipqs_doc["ipqs"].get("raw_success", False)),
            "message": last_ipqs_doc["ipqs"].get("raw_message", "") or "",
        }

    def _jsonify(doc):
        """Make datetime JSON-serialisable."""
        if isinstance(doc, dict):
            return {k: _jsonify(v) for k, v in doc.items()}
        if isinstance(doc, list):
            return [_jsonify(x) for x in doc]
        if isinstance(doc, datetime):
            return doc.isoformat()
        return doc

    return {
        "ipqs_enabled": bool(os.environ.get("IPQS_API_KEY", "").strip()),
        "ipqs_api_status": ipqs_api_status,
        "total_events": total_events,
        "visitor_groups": _jsonify(visitor_groups),
        "ip_groups": _jsonify(ip_groups),
        "high_risk_events": _jsonify(high_risk),
        "totals": {
            "visitor_groups": len(visitor_groups),
            "ip_groups": len(ip_groups),
            "high_risk_events": len(high_risk),
        },
    }
