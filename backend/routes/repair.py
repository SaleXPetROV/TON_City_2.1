"""Business repair router.

Endpoint:
  POST /api/business/{business_id}/repair — restore durability to 100%

Pricing: $CITY per 1% missing durability, table -20% reduced from baseline:
  Tier1 L1: 4, Tier1 L10: 88
  Tier2 L1: 20, Tier2 L10: 440
  Tier3 L1: 96, Tier3 L10: 2080

Active modifiers (stacking multiplicatively):
  • Patron buff «Ремонтный допуск» (-25%)
  • T3 resource buff Gold Bill (-20%)
  • Tech Umbrella alliance contract (-30%)

Split out of server.py (was ~1856-1971). Wrapped in try/except so repair
NEVER returns HTML 500 — always JSON 4xx/5xx — fixing the
'Unexpected token I, Internal S...' frontend bug.
"""
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, HTTPException, Depends

from core.dependencies import get_current_user
from core.models import User
from core.helpers import get_user_identifiers as _helper_gui, is_owner, get_user_filter
from business_config import BUSINESSES, TIER3_BUFFS, BUSINESS_KEY_MAP

logger = logging.getLogger(__name__)

# $CITY cost per 1% durability restored (already -20% from v3 baseline)
REPAIR_COST_PER_PCT = {
    1: {1: 4,  2: 6,   3: 8,   4: 11,  5: 16,  6: 22,  7: 32,   8: 45,   9: 62,   10: 88},
    2: {1: 20, 2: 28,  3: 40,  4: 56,  5: 80,  6: 112, 7: 160,  8: 224,  9: 312,  10: 440},
    3: {1: 96, 2: 136, 3: 192, 4: 272, 5: 384, 6: 536, 7: 752,  8: 1056, 9: 1480, 10: 2080},
}


def _resolve_business_config(business_type: str) -> dict:
    cfg = BUSINESSES.get(business_type)
    if cfg:
        return cfg
    mapped = BUSINESS_KEY_MAP.get(business_type, business_type)
    return BUSINESSES.get(mapped, {})


def create_repair_router(db):
    """Factory: build the repair router bound to the given Motor db."""
    router = APIRouter(prefix="/api", tags=["business-repair"])

    async def get_user_identifiers(current_user):
        return await _helper_gui(db, current_user)

    async def get_user_patron_buff(user_ids: set) -> dict:
        """Return TIER3_BUFFS entry if any of user's businesses has an active
        patron giving a buff. Empty dict otherwise."""
        if not user_ids:
            return {}
        id_list = list(user_ids)
        # Direct: user owns a business which is itself the patron with patron_buff
        user_biz = await db.businesses.find_one(
            {"owner": {"$in": id_list}, "patron_buff": {"$exists": True, "$ne": None}},
            {"_id": 0}
        )
        if user_biz and user_biz.get("patron_buff"):
            return TIER3_BUFFS.get(user_biz["patron_buff"], {})
        # Indirect: user's business has patron_id → patron has buff
        async for biz in db.businesses.find(
            {"owner": {"$in": id_list}, "patron_id": {"$exists": True}},
            {"_id": 0}
        ):
            patron = await db.businesses.find_one(
                {"id": biz.get("patron_id"), "patron_buff": {"$exists": True}},
                {"_id": 0}
            )
            if patron and patron.get("patron_buff"):
                return TIER3_BUFFS.get(patron["patron_buff"], {})
        return {}

    @router.post("/business/{business_id}/repair")
    async def repair_business(business_id: str, current_user: User = Depends(get_current_user)):
        """Repair business to full durability. Cost in $CITY.

        NOTE: wrapped in try/except so any unexpected failure yields a
        JSON 500 with `detail` rather than an HTML Internal Server Error.
        """
        try:
            business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
            if not business:
                raise HTTPException(status_code=404, detail="Бизнес не найден")

            ui = await get_user_identifiers(current_user)
            if not ui["user"] or not is_owner(business, ui["ids"]):
                raise HTTPException(status_code=403, detail="Это не ваш бизнес")
            user = ui["user"]

            try:
                current_dur = float(business.get("durability", 100))
            except (TypeError, ValueError):
                current_dur = 100.0
            if current_dur >= 100:
                raise HTTPException(status_code=400, detail="Бизнес не нуждается в ремонте")

            missing = 100 - current_dur
            btype = business.get("business_type", "") or ""
            try:
                level = int(business.get("level", 1) or 1)
            except (TypeError, ValueError):
                level = 1
            level = max(1, min(10, level))
            config = _resolve_business_config(btype) or {}
            tier = int(config.get("tier", 1) or 1)
            tier = max(1, min(3, tier))

            cost_per_pct = REPAIR_COST_PER_PCT.get(tier, {}).get(level, 10)
            cost_city = round(cost_per_pct * missing)

            # Patron Tier3 buff (-25% repair)
            try:
                owner_buff = await get_user_patron_buff(ui["ids"])
                if owner_buff.get("effect", {}).get("type") == "repair_cost_multiplier":
                    cost_city = round(cost_city * owner_buff["effect"]["value"])
            except Exception as e:
                logger.warning(f"repair: patron buff lookup failed: {e}")

            # T3 resource buff (Gold Bill -20%)
            try:
                now_utc = datetime.now(timezone.utc)
                for rb in (user.get("active_resource_buffs") or []):
                    if rb.get("effect_type") != "repair_cost_multiplier":
                        continue
                    expires = rb.get("expires_at") or ""
                    if expires:
                        try:
                            exp_dt = datetime.fromisoformat(expires.replace('Z', '+00:00'))
                            if exp_dt <= now_utc:
                                continue
                        except (ValueError, TypeError):
                            continue
                    cost_city = round(cost_city * float(rb.get("effect_value", 1.0)))
            except Exception as e:
                logger.warning(f"repair: resource buff calc failed: {e}")

            # Tech Umbrella contract (-30%)
            try:
                active_contract = await db.contracts.find_one(
                    {"vassal_business_id": business_id, "status": "active", "type": "tech_umbrella"},
                    {"_id": 0}
                )
                if active_contract:
                    cost_city = round(cost_city * 0.70)
            except Exception as e:
                logger.warning(f"repair: contract lookup failed: {e}")

            cost_ton = cost_city / 1000.0

            if float(user.get("balance_ton", 0) or 0) < cost_ton:
                raise HTTPException(
                    status_code=400,
                    detail=f"Недостаточно средств. Нужно {cost_city} $CITY ({cost_ton:.3f} TON)"
                )

            await db.businesses.update_one(
                {"id": business_id},
                {"$set": {
                    "durability": 100,
                    "last_wear_update": datetime.now(timezone.utc).isoformat(),
                    "last_repair": datetime.now(timezone.utc).isoformat(),
                }}
            )

            await db.users.update_one(
                get_user_filter(user),
                {"$inc": {"balance_ton": -cost_ton}}
            )

            logger.info(f"Business {business_id} repaired by {user.get('username')} for {cost_city} $CITY")

            return {
                "status": "repaired",
                "cost_city": cost_city,
                "cost_paid": cost_ton,
                "cost_ton": round(cost_ton, 4),
                "missing_pct": round(missing, 1),
                "cost_per_pct": cost_per_pct,
                "new_durability": 100,
                "new_balance": round(float(user.get("balance_ton", 0) or 0) - cost_ton, 4),
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"repair_business failed for {business_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка ремонта: {e}")

    return router
