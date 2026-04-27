"""Business management routes (detail, upgrade, collect income).

Split from server.py — was `# ==================== BUSINESS MANAGEMENT ROUTES ====================`
section. Repair moved separately to `routes/repair.py`.
"""
from datetime import datetime, timezone
import logging
import uuid as uuid_mod

from fastapi import APIRouter, HTTPException, Depends

from core.dependencies import get_current_user
from core.models import User
from core.helpers import (
    get_user_identifiers as _helper_gui,
    is_owner,
    get_user_filter,
    resolve_business_config,
    translate_resource_name,
)
from business_config import BUSINESSES, RESOURCE_TYPES, PATRON_BONUSES
from game_systems import (
    BusinessEconomics,
    IncomeCollector,
    PatronageSystem,
    get_production,
    get_consumption_breakdown,
    get_storage_capacity,
    get_user_production_buff,
)

logger = logging.getLogger(__name__)

REPAIR_COST_PER_PCT = {
    1: {1: 4,  2: 6,   3: 8,   4: 11,  5: 16,  6: 22,  7: 32,   8: 45,   9: 62,   10: 88},
    2: {1: 20, 2: 28,  3: 40,  4: 56,  5: 80,  6: 112, 7: 160,  8: 224,  9: 312,  10: 440},
    3: {1: 96, 2: 136, 3: 192, 4: 272, 5: 384, 6: 536, 7: 752,  8: 1056, 9: 1480, 10: 2080},
}


def create_business_mgmt_router(db):
    router = APIRouter(prefix="/api", tags=["business-mgmt"])

    async def get_user_identifiers(current_user):
        return await _helper_gui(db, current_user)

    @router.get("/business/{business_id}")
    async def get_business_details(business_id: str, current_user: User = Depends(get_current_user)):
        """Get detailed business information (config, production, patron, upgrade, repair cost)."""
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")

        # Patron info
        patron_info = None
        patron_bonus = 1.0
        if business.get("patron_id"):
            patron_biz = await db.businesses.find_one({"id": business["patron_id"]}, {"_id": 0})
            if patron_biz:
                patron_type = PatronageSystem.get_patron_type(patron_biz.get("business_type"))
                patron_config = resolve_business_config(patron_biz.get("business_type"))
                patron_info = {
                    "id": patron_biz["id"],
                    "owner": patron_biz.get("owner"),
                    "type": patron_type,
                    "name": patron_config.get("name", {}),
                    "icon": patron_config.get("icon", ""),
                    "level": patron_biz.get("level", 1),
                    "bonus_type": PATRON_BONUSES.get(patron_type, {}).get("type"),
                }
                patron_bonus = PatronageSystem.get_patron_bonus_multiplier(
                    patron_type, patron_biz.get("level", 1), "income"
                )

        # Active resource-buff multiplier from owner (+8% from neuro_core, etc.)
        owner_user = await db.users.find_one({"$or": [
            {"telegram_id": business.get("owner")},
            {"username": business.get("owner")},
            {"email": business.get("owner")},
        ]}, {"active_resource_buffs": 1, "_id": 0})
        user_buff_mult = get_user_production_buff(owner_user) if owner_user else 1.0

        # Production & pending income
        biz_type = business.get("business_type", "")
        biz_level = business.get("level", 1)
        production = BusinessEconomics.calculate_effective_production(business, patron_bonus, user_buff_mult)
        production["base_production"] = get_production(biz_type, biz_level)
        production["consumption_breakdown"] = get_consumption_breakdown(biz_type, biz_level)
        pending = IncomeCollector.calculate_pending_income(business, patron_bonus=patron_bonus, user_buff_multiplier=user_buff_mult)

        # Upgrade & repair
        can_upgrade, upgrade_cost = BusinessEconomics.can_upgrade(business)
        cur_dur = business.get("durability", 100)
        missing = 100 - cur_dur
        cfg = resolve_business_config(biz_type)
        tier = cfg.get("tier", 1)
        cost_per_pct = REPAIR_COST_PER_PCT.get(tier, {}).get(biz_level, 10)
        repair_cost = {
            "cost_city": round(cost_per_pct * missing),
            "cost_per_pct": cost_per_pct,
            "missing_pct": round(missing, 1),
            "cost_ton": round(cost_per_pct * missing / 1000, 4),
        }

        config = resolve_business_config(business.get("business_type"))

        return {
            "business": {
                **business,
                "config": {
                    "name": config.get("name"),
                    "tier": config.get("tier"),
                    "icon": config.get("icon"),
                    "produces": config.get("produces"),
                    "consumes": config.get("consumes", []),
                    "is_patron": config.get("is_patron", False),
                },
            },
            "patron": patron_info,
            "production": production,
            "pending_income": pending,
            "upgrade": {
                "can_upgrade": can_upgrade,
                "next_level": business.get("level", 1) + 1 if can_upgrade else None,
                "cost": upgrade_cost,
            },
            "repair": repair_cost,
        }

    @router.post("/business/{business_id}/upgrade")
    async def upgrade_business(business_id: str, current_user: User = Depends(get_current_user)):
        """Upgrade business to next level."""
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")

        ui = await get_user_identifiers(current_user)
        if not ui["user"] or not is_owner(business, ui["ids"]):
            raise HTTPException(status_code=403, detail="Это не ваш бизнес")
        user = ui["user"]

        can_upgrade, cost = BusinessEconomics.can_upgrade(business)
        if not can_upgrade:
            raise HTTPException(status_code=400, detail="Достигнут максимальный уровень")

        if user.get("balance_ton", 0) * 1000 < cost.get("city", cost.get("ton", 0)):
            raise HTTPException(status_code=400, detail="Недостаточно $CITY для улучшения")

        if cost.get("resource_type") and cost.get("resource_amount", 0) > 0:
            current_resource = user.get("resources", {}).get(cost["resource_type"], 0)
            if current_resource < cost["resource_amount"]:
                res_name = translate_resource_name(cost["resource_type"])
                raise HTTPException(
                    status_code=400,
                    detail=f"Недостаточно {res_name}: нужно {cost['resource_amount']}, есть {int(current_resource)}",
                )

        upgrade_data = BusinessEconomics.upgrade_business(business)
        await db.businesses.update_one({"id": business_id}, {"$set": upgrade_data})

        upgrade_city_cost = cost.get("city", cost.get("ton", 0))
        upgrade_ton_cost = upgrade_city_cost / 1000.0
        await db.users.update_one(
            get_user_filter(user), {"$inc": {"balance_ton": -upgrade_ton_cost}}
        )

        if cost.get("resource_type") and cost.get("resource_amount", 0) > 0:
            await db.users.update_one(
                get_user_filter(user),
                {"$inc": {f"resources.{cost['resource_type']}": -cost["resource_amount"]}},
            )

        await db.admin_stats.update_one(
            {"type": "treasury"},
            {"$inc": {"upgrade_income": upgrade_city_cost, "total_tax": upgrade_city_cost * 0.1}},
            upsert=True,
        )

        logger.info(
            f"Business {business_id} upgraded to level {upgrade_data['level']} by {user.get('username')}"
        )

        tx = {
            "id": str(uuid_mod.uuid4()),
            "user_id": user.get("id"),
            "type": "business_upgrade",
            "amount": -upgrade_ton_cost,
            "amount_city": -upgrade_city_cost,
            "details": {
                "business_id": business_id,
                "business_type": business.get("business_type"),
                "new_level": upgrade_data["level"],
                "cost_city": upgrade_city_cost,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.transactions.insert_one(tx.copy())

        return {
            "status": "upgraded",
            "new_level": upgrade_data["level"],
            "new_capacity": upgrade_data.get("storage.capacity", 0),
            "cost_paid": cost,
            "new_balance": (user.get("balance_ton", 0) - upgrade_ton_cost) * 1000,
        }

    @router.get("/business/{business_id}/upgrade-cost")
    async def get_upgrade_cost(business_id: str, current_user: User = Depends(get_current_user)):
        """Get upgrade cost details for a business (production/storage before & after)."""
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")

        can_upgrade, cost = BusinessEconomics.can_upgrade(business)
        current_level = business.get("level", 1)
        biz_type = business.get("business_type", "")
        next_level = current_level + 1 if can_upgrade else None

        current_production = get_production(biz_type, current_level)
        next_production = get_production(biz_type, next_level) if next_level else None
        current_storage = get_storage_capacity(biz_type, current_level)
        next_storage = get_storage_capacity(biz_type, next_level) if next_level else None

        resource_meta = None
        if cost and cost.get("resource_type"):
            rt = cost["resource_type"]
            meta = RESOURCE_TYPES.get(rt, {})
            resource_meta = {
                "id": rt,
                "name_ru": meta.get("name_ru", rt),
                "name_en": meta.get("name_en", rt),
                "icon": meta.get("icon", "📦"),
            }

        current_consumption = get_consumption_breakdown(biz_type, current_level)
        next_consumption = get_consumption_breakdown(biz_type, next_level) if next_level else None

        return {
            "can_upgrade": can_upgrade,
            "current_level": current_level,
            "next_level": next_level,
            "cost": cost,
            "resource_meta": resource_meta,
            "current_production": current_production,
            "next_production": next_production,
            "current_storage": current_storage,
            "next_storage": next_storage,
            "current_consumption": current_consumption,
            "next_consumption": next_consumption,
        }

    @router.post("/business/{business_id}/collect")
    async def collect_business_income(business_id: str, current_user: User = Depends(get_current_user)):
        """Collect accumulated income from business."""
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")

        ui = await get_user_identifiers(current_user)
        if not ui["user"] or not is_owner(business, ui["ids"]):
            raise HTTPException(status_code=403, detail="Это не ваш бизнес")

        patron_wallet = None
        if business.get("patron_id"):
            patron_biz = await db.businesses.find_one({"id": business["patron_id"]}, {"_id": 0})
            if patron_biz:
                patron_wallet = patron_biz.get("owner")

        collection = IncomeCollector.collect_income(business, patron_wallet)

        if collection.get("halted"):
            raise HTTPException(status_code=400, detail="Производство остановлено - нужен ремонт")

        if collection["collected"] <= 0:
            return {"status": "nothing_to_collect", "hours": collection["hours"]}

        user_filter = get_user_filter(ui["user"])
        await db.users.update_one(
            user_filter,
            {"$inc": {
                "balance_ton": collection["player_receives"],
                "total_income": collection["player_receives"],
            }},
        )

        if patron_wallet and collection["patron_receives"] > 0:
            await db.users.update_one(
                {"wallet_address": patron_wallet},
                {"$inc": {
                    "balance_ton": collection["patron_receives"],
                    "total_income": collection["patron_receives"],
                }},
            )

        await db.admin_stats.update_one(
            {"type": "treasury"},
            {"$inc": {
                "business_tax": collection["treasury_receives"],
                "total_tax": collection["treasury_receives"],
            }},
            upsert=True,
        )

        await db.businesses.update_one(
            {"id": business_id},
            {"$set": {"last_collection": datetime.now(timezone.utc).isoformat()}},
        )

        logger.info(f"Collected {collection['collected']} TON from business {business_id}")

        return {
            "status": "collected",
            "gross_income": collection["collected"],
            "player_receives": collection["player_receives"],
            "treasury_tax": collection["treasury_receives"],
            "patron_tax": collection["patron_receives"],
            "hours_accumulated": collection["hours"],
        }

    return router
