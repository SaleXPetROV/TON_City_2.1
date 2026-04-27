"""
TON-City Background Tasks V2.0 - Complete Economic Tick Engine
Handles: Auto-collection, Midnight Decay, Durability Wear,
NPC Interventions, Price Updates, Bankruptcy Checks, Events

TICK ORDER:
1. Production
2. Resource purchasing (consumption)
3. Maintenance deduction
4. Profit calculation
5. Income tax
6. Turnover tax
7. NPC consumption
8. Price updates
9. Monopoly check
10. Inflation
11. Bankruptcy check
12. Events
13. Save snapshot

DURABILITY RULES:
- 50-100%: 100% production
- 1-50%: 70% production
- 0%: Business stops
"""
import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

from business_config import (
    BUSINESSES, BUSINESS_KEY_MAP, TIER_TAXES, MAINTENANCE_COSTS, RESOURCE_TYPES,
    BUSINESS_LEVELS, MIDNIGHT_DECAY_RATE,
    NPC_PRICE_FLOOR, NPC_PRICE_CEILING, MONOPOLY_THRESHOLD,
    get_production, get_consumption, get_consumption_breakdown,
    calculate_effective_production, get_daily_wear, get_storage_capacity,
    TIER3_BUFFS, get_warehouse_weight,
)
from game_systems import (
    BusinessEconomics, TaxSystem, NPCMarketSystem, WarehouseSystem,
    InflationSystem, BankruptcySystem, EventsSystem, EconomicTickEngine,
    IncomeCollector,
)

# Resource name translations for notifications
RESOURCE_NAMES = {
    "energy": "Энергия", "cu": "Вычисления", "quartz": "Кварц", 
    "traffic": "Трафик", "cooling": "Охлаждение", "biomass": "Биомасса", "scrap": "Металлолом",
    "chips": "Микросхемы", "nft": "NFT-арт", "neurocode": "Нейрокод",
    "logistics": "Топливо", "repair_kits": "Ремкомплект", "vr_experience": "VR-опыт",
    "profit_ton": "Кибер-фуд",
    "neuro_core": "Нейро-ядро", "gold_bill": "Золотой вексель", "license_token": "Лицензия",
    "luck_chip": "Фишка удачи", "war_protocol": "Боевой протокол", 
    "bio_module": "Био-модуль", "gateway_code": "Код шлюза",
}

logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'ton_city')

# Global scheduler
scheduler: AsyncIOScheduler = None

# Import telegram notifications
try:
    from telegram_notifications import (
        notify_low_durability, notify_critical_durability, notify_business_stopped,
        notify_resources_full, get_user_telegram_chat_id, should_notify, clear_notification_state,
        notify_durability_warning_20,
        RESOURCE_NOTIFICATION_THRESHOLD
    )
    TELEGRAM_ENABLED = True
except ImportError:
    TELEGRAM_ENABLED = False
    logger.warning("Telegram notifications not available")


def get_durability_multiplier(durability: float) -> float:
    """
    Get production multiplier based on durability.
    50-100%: 100% production
    5-50%: 80% production
    0%: 0% production (stopped)
    """
    if durability <= 0:
        return 0.0
    elif durability < 50:
        return 0.8
    else:
        return 1.0


# ==================== MAIN ECONOMIC TICK ====================

async def economic_tick():
    """
    Main economic tick - runs every hour.
    Processes all active businesses through the 13-step pipeline.
    """
    try:
        logger.info("⚙️ === ECONOMIC TICK STARTED ===")
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        now = datetime.now(timezone.utc)
        
        # Get ALL businesses (except bankrupt). is_active is re-evaluated each tick.
        businesses = await db.businesses.find({"paused_reason": {"$ne": "bankruptcy"}}).to_list(length=None)
        
        if not businesses:
            logger.info("📊 No active businesses - tick skipped")
            client.close()
            return
        
        # Get current market prices
        market_prices_doc = await db.market_prices.find_one({"type": "current"})
        market_prices = {}
        if market_prices_doc:
            market_prices = market_prices_doc.get("prices", {})
        else:
            # Initialize with base prices
            market_prices = {r: d["base_price"] for r, d in RESOURCE_TYPES.items()}
            await db.market_prices.update_one(
                {"type": "current"},
                {"$set": {"prices": market_prices, "updated_at": now.isoformat()}},
                upsert=True
            )
        
        # Get all users - index by both id AND wallet_address
        users = {}
        users_cursor = db.users.find({})
        async for user in users_cursor:
            uid = user.get("id")
            wallet = user.get("wallet_address")
            if uid:
                users[uid] = user
            if wallet:
                users[wallet] = user
        
        # Track totals
        total_tax_collected = 0
        total_maintenance_collected = 0
        total_production = {}
        total_consumption = {}
        tick_results = []
        businesses_processed = 0
        
        # === PRE-COMPUTE PER-USER STORAGE FULLNESS ===
        # If a user's total warehouse (personal resources + business storage) is full,
        # all their businesses go idle until space frees up
        user_storage_full = {}
        user_businesses_map = {}
        for biz in businesses:
            owner = biz.get("owner")
            if owner:
                user_businesses_map.setdefault(owner, []).append(biz)
        
        for owner, owner_bizs in user_businesses_map.items():
            user = users.get(owner, {})
            # Personal resources count
            user_resources = user.get("resources", {})
            # Weighted: tier 1 = ×1, tier 2 = ×5, tier 3 = ×20, floor (consistent with display)
            personal_used = sum(
                int(float(v)) * get_warehouse_weight(res)
                for res, v in user_resources.items()
                if int(float(v)) > 0
            )
            # Business storage items are NOT added here — they're already in user.resources
            total_biz_used = 0
            total_used = personal_used + total_biz_used
            # Total capacity from businesses
            total_cap = sum(
                b.get("storage", {}).get("capacity", 0) for b in owner_bizs
            )
            # Storage is full if used >= capacity (and capacity > 0)
            user_storage_full[owner] = (total_cap > 0 and total_used >= total_cap)
            if user_storage_full[owner]:
                logger.info(f"⏸️ User {owner[:12]}... storage full ({total_used}/{total_cap}) - all businesses idle")
        
        # === PROCESS EACH BUSINESS (Steps 1-6) ===
        for business in businesses:
            try:
                business_id = business.get("id")
                owner = business.get("owner")
                business_type = business.get("business_type")
                level = business.get("level", 1)
                durability = business.get("durability", 100)
                
                if not business_type or (business_type not in BUSINESSES and business_type not in BUSINESS_KEY_MAP):
                    continue
                
                # Resolve alias (e.g. cold_storage → hydro_cooling)
                canonical_type = BUSINESS_KEY_MAP.get(business_type, business_type)
                config = BUSINESSES.get(canonical_type, {})
                tier = config.get("tier", 1)
                
                # Calculate time since last tick
                last_tick = business.get("last_tick") or business.get("last_collection")
                hours_passed = 1.0  # Default to 1 hour
                if last_tick:
                    try:
                        last_dt = datetime.fromisoformat(str(last_tick).replace('Z', '+00:00'))
                        hours_passed = (now - last_dt).total_seconds() / 3600
                    except (ValueError, TypeError):
                        hours_passed = 1.0 / 1440  # fallback: 1 minute
                
                # Skip if less than 30 seconds since last tick
                if hours_passed < 0.008:  # ~30 seconds
                    continue
                
                # Skip if business is on sale - no production, no wear
                if business.get("on_sale") or business.get("status") == "on_sale":
                    continue
                
                # Skip production if user's total warehouse is full
                storage_blocked = user_storage_full.get(owner, False)
                
                # --- Step 1: Apply durability wear ---
                wear_result = BusinessEconomics.apply_wear(business, hours_passed)
                new_durability = wear_result["durability"]
                old_durability = business.get("durability", 100)
                
                # --- DURABILITY-BASED NOTIFICATIONS ---
                if TELEGRAM_ENABLED:
                    biz_name = config.get("name", {}).get("ru", business_type)
                    chat_id = await get_user_telegram_chat_id(db, owner)
                    
                    if chat_id:
                        # Business stopped (0% durability)
                        if new_durability <= 0 and old_durability > 0:
                            if should_notify(owner, "stopped", business_id):
                                await notify_business_stopped(chat_id, biz_name)
                        # Critical durability (<10%)
                        elif new_durability < 10 and old_durability >= 10:
                            if should_notify(owner, "critical", business_id):
                                await notify_critical_durability(chat_id, biz_name, new_durability)
                        # Warning (<20%) — early alarm before critical
                        elif new_durability < 20 and old_durability >= 20:
                            if should_notify(owner, "warn20", business_id):
                                await notify_durability_warning_20(chat_id, biz_name, new_durability)
                        # Low durability (<50%)
                        elif new_durability < 50 and old_durability >= 50:
                            if should_notify(owner, "low", business_id):
                                await notify_low_durability(chat_id, biz_name, new_durability)

                        # Clear notifications when repaired
                        if new_durability >= 50 and old_durability < 50:
                            clear_notification_state(owner, "low", business_id)
                            clear_notification_state(owner, "warn20", business_id)
                            clear_notification_state(owner, "critical", business_id)
                        if new_durability >= 20 and old_durability < 20:
                            clear_notification_state(owner, "warn20", business_id)
                        if new_durability > 0 and old_durability <= 0:
                            clear_notification_state(owner, "stopped", business_id)
                
                # --- Get durability multiplier ---
                durability_mult = get_durability_multiplier(new_durability)
                
                # If business is stopped (0% durability), skip production
                if durability_mult == 0:
                    # Update only durability, no production
                    await db.businesses.update_one(
                        {"id": business_id},
                        {"$set": {"durability": 0, "status": "stopped", "last_tick": now.isoformat()}}
                    )
                    continue
                
                # --- Step 1b: Production ---
                business_copy = {**business, "durability": new_durability}
                patron_bonus = 1.0
                if business.get("patron_id"):
                    patron_bonus = 1.1  # Simplified patron bonus
                
                # Get active buff: contract_buff takes priority over patron buff
                active_buff = {}
                if business.get("contract_buff"):
                    active_buff = TIER3_BUFFS.get(business["contract_buff"], {})
                elif business.get("patron_id"):
                    patron_biz = await db.businesses.find_one({"id": business["patron_id"]}, {"_id": 0, "patron_buff": 1})
                    if patron_biz and patron_biz.get("patron_buff"):
                        active_buff = TIER3_BUFFS.get(patron_biz["patron_buff"], {})
                buff_effect = active_buff.get("effect", {})
                buff_type = buff_effect.get("type", "")
                buff_value = buff_effect.get("value", 1.0)
                
                effective_prod = calculate_effective_production(
                    canonical_type, level, new_durability, patron_bonus
                )
                produces = config.get("produces")
                
                # Apply Стахановец buff (+7% production)
                if buff_type == "production_multiplier":
                    effective_prod = effective_prod * buff_value
                
                # Scale production by hours passed (production values are per-tick/day)
                hourly_fraction = hours_passed / 24.0
                actual_production = effective_prod * hourly_fraction
                
                # --- Step 2: Consumption ---
                # Formula: daily_consumption / 24 / 60 * minutes_passed
                # = daily_consumption * hours_passed / 24
                # Keeps 6 decimal places to avoid rounding error (e.g. 25/1440 = 0.017361, not 0.02)
                consumption_breakdown = get_consumption_breakdown(canonical_type, level)
                # Apply Бережливое производство buff (-5% consumption)
                consumption_multiplier = buff_value if buff_type == "consumption_multiplier" else 1.0
                scaled_consumption = {}
                for r, daily_amount in consumption_breakdown.items():
                    fractional = round(daily_amount * hourly_fraction * consumption_multiplier, 6)
                    scaled_consumption[r] = fractional
                
                # Check user's resource inventory
                user = users.get(owner, {})
                user_resources = user.get("resources", {})
                
                # Второй шанс: 2% chance to skip resource consumption
                import random as _random
                free_cycle = False
                if buff_type == "free_cycle_chance" and _random.random() < buff_value:
                    free_cycle = True
                
                can_operate = True
                if consumption_breakdown and not free_cycle:
                    for resource, required in scaled_consumption.items():
                        available = user_resources.get(resource, 0)
                        if required > 0 and available < required:
                            can_operate = False
                            logger.info(f"⛔ {business_id} ({business_type}): need {required:.4f} {resource}, have {available:.2f}")
                            break
                
                if not can_operate:
                    actual_production = 0
                    # Apply 3x total durability loss when idle (extra 2x on top of normal wear)
                    from game_systems import get_daily_wear
                    daily_wear = get_daily_wear(canonical_type, level)
                    extra_wear = daily_wear * 100 * (hours_passed / 24.0) * 2
                    new_durability = max(0, new_durability - extra_wear)
                    logger.info(f"⛔ Business {business_id} ({business_type}) idle - insufficient resources, extra wear={extra_wear:.2f}%")
                
                # If storage is full - production blocked regardless
                if storage_blocked:
                    actual_production = 0
                    can_operate = False
                    logger.info(f"📦 Business {business_id} ({business_type}) idle - storage full")
                
                # --- Step 3: Maintenance ---
                maintenance = MAINTENANCE_COSTS.get(tier, {}).get(level, 0.05)
                maintenance_cost = maintenance * hourly_fraction
                
                # --- Step 4: Profit ---
                if produces in ("ton", "profit_ton"):
                    gross_profit = actual_production * 0.01
                elif produces and produces in market_prices:
                    gross_profit = actual_production * max(0.01, market_prices.get(produces, 0.01))
                else:
                    gross_profit = 0
                
                # --- Step 5: Income tax ---
                tax_rate = TIER_TAXES.get(tier, 0.15)
                income_tax = gross_profit * tax_rate
                
                # --- Step 6: Patron tax ---
                has_patron = business.get("patron_id") is not None
                patron_tax = (gross_profit - income_tax) * 0.01 if has_patron else 0
                
                # Net income to player
                net_income = gross_profit - income_tax - patron_tax - maintenance_cost
                
                # --- Update business in DB ---
                update_ops = {
                    "$set": {
                        "durability": new_durability,
                        "last_tick": now.isoformat(),
                        "last_collection": now.isoformat(),
                        "last_wear_update": now.isoformat(),
                        "work_status": "idle" if (not can_operate or storage_blocked) else "active",
                        "is_active": can_operate and not storage_blocked,
                    }
                }
                
                # Also update business storage with produced resources
                if actual_production > 0 and produces and produces != "ton" and can_operate:
                    update_ops.setdefault("$inc", {})
                    update_ops["$inc"][f"storage.items.{produces}"] = round(actual_production, 2)
                    
                await db.businesses.update_one({"id": business_id}, update_ops)
                
                # --- Update user ---
                user_update = {"$inc": {}}
                
                # НЕ добавляем деньги автоматически - только ресурсы!
                # Деньги получаются только при продаже ресурсов на маркетплейсе
                
                # Add produced resources to inventory
                if can_operate and actual_production > 0 and produces and produces != "ton":
                    user_update["$inc"][f"resources.{produces}"] = round(actual_production, 2)
                    logger.info(f"📦 Business {business_id} produced {round(actual_production, 2)} {produces} for {owner}")
                
                # Deduct consumed resources
                if can_operate:
                    for resource, amount in scaled_consumption.items():
                        if amount > 0:
                            user_update["$inc"][f"resources.{resource}"] = -amount
                
                if user_update["$inc"]:
                    await db.users.update_one(
                        {"$or": [{"wallet_address": owner}, {"id": owner}]},
                        user_update
                    )
                
                # Track totals
                total_tax_collected += income_tax + patron_tax
                total_maintenance_collected += maintenance_cost
                
                if produces and actual_production > 0:
                    total_production[produces] = total_production.get(produces, 0) + actual_production
                for r, a in scaled_consumption.items():
                    if can_operate:
                        total_consumption[r] = total_consumption.get(r, 0) + a
                
                tick_results.append({
                    "business_id": business_id,
                    "type": business_type,
                    "owner": owner,
                    "net_income": round(net_income, 6),
                    "production": round(actual_production, 2),
                    "produces": produces,
                    "maintenance": round(maintenance_cost, 6),
                    "tax": round(income_tax, 6),
                    "durability": new_durability,
                })
                
                businesses_processed += 1

                # === CONTRACT EXECUTION ===
                if can_operate and actual_production > 0:
                    active_contract = await db.contracts.find_one(
                        {"vassal_business_id": business_id, "status": "active"},
                        {"_id": 0}
                    )
                    if active_contract:
                        contract_type = active_contract.get("type")
                        contract_patron_id = active_contract.get("patron_id")
                        today_str = now.strftime("%Y-%m-%d")
                        contract_violation = False

                        if contract_type == "tax_haven":
                            # Vassal pays 10% of gross_profit value in $CITY
                            city_payment = round(gross_profit * 0.10 * 1000, 2)
                            if city_payment > 0:
                                await db.users.update_one(
                                    {"$or": [{"wallet_address": owner}, {"id": owner}]},
                                    {"$inc": {"city_balance": -city_payment}}
                                )
                                await db.users.update_one(
                                    {"$or": [{"id": contract_patron_id}, {"wallet_address": contract_patron_id}]},
                                    {"$inc": {"city_balance": city_payment}}
                                )

                        elif contract_type == "raw_material":
                            if produces and produces != "ton" and actual_production > 0:
                                transfer = round(actual_production * 0.15, 2)
                                await db.users.update_one(
                                    {"$or": [{"wallet_address": owner}, {"id": owner}]},
                                    {"$inc": {f"resources.{produces}": -transfer}}
                                )
                                await db.users.update_one(
                                    {"$or": [{"id": contract_patron_id}, {"wallet_address": contract_patron_id}]},
                                    {"$inc": {f"resources.{produces}": transfer}}
                                )
                            else:
                                contract_violation = True

                        # tech_umbrella: no per-tick action (discount applied at repair time)

                        if contract_violation:
                            v_days = list(active_contract.get("violation_days", []))
                            if today_str not in v_days:
                                v_days.append(today_str)
                                recent = sorted(v_days)[-3:]
                                auto_cancel = False
                                if len(recent) >= 3:
                                    from datetime import date as _date
                                    parsed = [_date.fromisoformat(d) for d in recent]
                                    # Check if last 3 days are consecutive
                                    if all((parsed[i+1] - parsed[i]).days <= 1 for i in range(len(parsed)-1)):
                                        auto_cancel = True
                                if auto_cancel:
                                    await db.contracts.update_one(
                                        {"id": active_contract["id"]},
                                        {"$set": {"status": "cancelled", "cancelled_by": "system",
                                                  "cancelled_at": now.isoformat(), "violation_days": v_days}}
                                    )
                                    await db.businesses.update_one(
                                        {"id": business_id},
                                        {"$unset": {"contract_buff": "", "contract_id": ""}}
                                    )
                                else:
                                    await db.contracts.update_one(
                                        {"id": active_contract["id"]},
                                        {"$set": {"violation_days": v_days}}
                                    )

                # Check if resources will run out within 12 hours for any business
                if can_operate and consumption_breakdown:
                    updated_user = await db.users.find_one(
                        {"$or": [{"wallet_address": owner}, {"id": owner}]},
                        {"resources": 1, "telegram_chat_id": 1, "_id": 0}
                    )
                    if updated_user:
                        user_res = updated_user.get("resources", {})
                        for resource, daily_amount in consumption_breakdown.items():
                            if daily_amount > 0:
                                current = user_res.get(resource, 0)
                                hours_left = (current / daily_amount) * 24 if daily_amount > 0 else 999
                                # Only create notification at 12h, 4h, or 0.08h (5min) thresholds
                                threshold = None
                                if hours_left <= 0.083:  # 5 min
                                    threshold = "5min"
                                elif hours_left <= 4:
                                    threshold = "4h"
                                elif hours_left <= 12:
                                    threshold = "12h"
                                
                                if threshold:
                                    # Check if this threshold notification already sent for this owner
                                    notif_key = f"low_resource_{owner}_{threshold}"
                                    existing = await db.notifications.find_one({"key": notif_key, "read": False})
                                    if not existing:
                                        biz_name = config.get("name", {})
                                        biz_name_str = biz_name.get("ru", business_type) if isinstance(biz_name, dict) else str(biz_name)
                                        res_name = RESOURCE_NAMES.get(resource, resource)
                                        await db.notifications.insert_one({
                                            "id": str(uuid.uuid4()),
                                            "key": notif_key,
                                            "user_id": owner,
                                            "type": "low_resource",
                                            "title": "Заканчиваются ресурсы!",
                                            "message": f"⚠️ {biz_name_str}: {res_name} хватит на {hours_left:.0f}ч",
                                            "threshold": threshold,
                                            "read": False,
                                            "created_at": now.isoformat(),
                                        })
                
            except Exception as e:
                logger.error(f"❌ Tick error for business {business.get('id')}: {e}")
                continue
        
        # === SUPPLY CONTRACTS EXECUTION (Alliance auto-delivery) ===
        try:
            active_supply = await db.supply_contracts.find({"status": "active"}).to_list(100)
            supply_executed = 0
            for sc in active_supply:
                try:
                    seller_id = sc.get("seller_id")
                    buyer_id = sc.get("buyer_id")
                    resource = sc.get("resource_type")
                    daily_amount = sc.get("amount_per_day", 0)
                    price_per_10 = sc.get("price_per_10", 0)
                    
                    if not seller_id or not buyer_id or not resource or daily_amount <= 0:
                        continue
                    
                    # Calculate per-tick delivery (1 tick per minute = 1/1440 of daily)
                    tick_amount = round(daily_amount / 1440.0, 6)
                    tick_cost_city = round(tick_amount * price_per_10 / 10.0, 6)
                    tick_cost_ton = tick_cost_city / 1000.0
                    
                    if tick_amount < 0.0001:
                        continue
                    
                    # Check seller has resources
                    seller = await db.users.find_one(
                        {"$or": [{"id": seller_id}, {"wallet_address": seller_id}]},
                        {"_id": 0, "resources": 1, "balance_ton": 1}
                    )
                    seller_has = (seller or {}).get("resources", {}).get(resource, 0)
                    
                    if seller_has < tick_amount:
                        # Violation: seller can't deliver
                        v_days = list(sc.get("violation_days", []))
                        today_str = now.strftime("%Y-%m-%d")
                        if today_str not in v_days:
                            v_days.append(today_str)
                            if len(v_days) >= 3:
                                await db.supply_contracts.update_one(
                                    {"id": sc["id"]},
                                    {"$set": {"status": "cancelled", "cancelled_by": "system", "cancelled_at": now.isoformat()}}
                                )
                                logger.info(f"📦❌ Supply contract {sc['id']} auto-cancelled: 3 violations")
                            else:
                                await db.supply_contracts.update_one(
                                    {"id": sc["id"]},
                                    {"$set": {"violation_days": v_days}}
                                )
                        continue
                    
                    # Check buyer has funds
                    buyer = await db.users.find_one(
                        {"$or": [{"id": buyer_id}, {"wallet_address": buyer_id}]},
                        {"_id": 0, "balance_ton": 1}
                    )
                    buyer_balance = (buyer or {}).get("balance_ton", 0)
                    
                    if buyer_balance < tick_cost_ton:
                        continue  # Skip but no violation for buyer
                    
                    # Execute transfer: resources seller → buyer, money buyer → seller
                    await db.users.update_one(
                        {"$or": [{"id": seller_id}, {"wallet_address": seller_id}]},
                        {"$inc": {f"resources.{resource}": -tick_amount, "balance_ton": tick_cost_ton}}
                    )
                    await db.users.update_one(
                        {"$or": [{"id": buyer_id}, {"wallet_address": buyer_id}]},
                        {"$inc": {f"resources.{resource}": tick_amount, "balance_ton": -tick_cost_ton}}
                    )
                    
                    # Track cumulative delivery
                    await db.supply_contracts.update_one(
                        {"id": sc["id"]},
                        {"$inc": {"total_delivered": tick_amount, "total_paid_city": tick_cost_city}}
                    )
                    
                    supply_executed += 1
                    
                    # Check expiry
                    expires_at = sc.get("expires_at")
                    if expires_at:
                        exp_dt = datetime.fromisoformat(str(expires_at).replace('Z', '+00:00'))
                        if now >= exp_dt:
                            await db.supply_contracts.update_one(
                                {"id": sc["id"]},
                                {"$set": {"status": "completed", "completed_at": now.isoformat()}}
                            )
                            logger.info(f"📦✅ Supply contract {sc['id']} completed (expired)")
                    
                except Exception as sce:
                    logger.error(f"❌ Supply contract error {sc.get('id')}: {sce}")
            
            if supply_executed > 0:
                logger.info(f"📦 Supply contracts executed: {supply_executed}")
        except Exception as e:
            logger.error(f"❌ Supply contracts batch error: {e}")
        
        # === GLOBAL STEPS (7-13) ===
        
        # Step 7: NPC consumption
        total_supply = {}
        supply_cursor = db.users.aggregate([
            {"$project": {"resources": 1}},
        ])
        async for doc in supply_cursor:
            for r, a in doc.get("resources", {}).items():
                total_supply[r] = total_supply.get(r, 0) + a
        
        npc_consumed = NPCMarketSystem.calculate_npc_consumption(total_supply)
        
        # Step 8: Price updates / NPC interventions
        interventions = []
        for resource, price in market_prices.items():
            intervention = NPCMarketSystem.check_price_intervention(resource, price)
            if intervention:
                interventions.append(intervention)
                # Adjust price towards base
                base_price = RESOURCE_TYPES.get(resource, {}).get("base_price", price)
                if intervention["action"] == "buy":
                    market_prices[resource] = price * 1.05  # Push price up 5%
                else:
                    market_prices[resource] = price * 0.95  # Push price down 5%
        
        # Step 10: Inflation
        total_ton_produced = sum(r.get("net_income", 0) for r in tick_results if r.get("net_income", 0) > 0)
        total_ton_sunk = total_tax_collected + total_maintenance_collected
        inflation_factor = InflationSystem.calculate_inflation_factor(total_ton_produced, total_ton_sunk)
        market_prices = InflationSystem.apply_price_inflation(market_prices, inflation_factor)
        
        # Save updated prices
        await db.market_prices.update_one(
            {"type": "current"},
            {"$set": {"prices": market_prices, "updated_at": now.isoformat()}},
            upsert=True
        )
        
        # Step 11: Bankruptcy checks
        bankruptcies = []
        async for user in db.users.find({"balance_ton": {"$lt": -10}}):
            bankruptcy = BankruptcySystem.check_bankruptcy(user)
            if bankruptcy["is_bankrupt"]:
                bankruptcies.append({
                    "user": user.get("wallet_address") or user.get("id"),
                    "balance": user.get("balance_ton"),
                    "reason": bankruptcy["reason"],
                })
                # Pause all their businesses
                await db.businesses.update_many(
                    {"owner": user.get("wallet_address") or user.get("id")},
                    {"$set": {"is_active": False, "paused_reason": "bankruptcy"}}
                )
        
        # Step 12: Events
        events = EventsSystem.roll_events()
        
        # Step 13: Save snapshot
        await db.admin_stats.update_one(
            {"type": "treasury"},
            {"$inc": {
                "total_tax": total_tax_collected,
                "total_maintenance": total_maintenance_collected,
            }},
            upsert=True
        )
        
        snapshot = {
            "type": "tick_snapshot",
            "timestamp": now.isoformat(),
            "businesses_processed": businesses_processed,
            "total_tax_collected": round(total_tax_collected, 4),
            "total_maintenance_collected": round(total_maintenance_collected, 4),
            "total_production": {k: round(v, 2) for k, v in total_production.items()},
            "total_consumption": {k: round(v, 2) for k, v in total_consumption.items()},
            "npc_consumed": npc_consumed,
            "npc_interventions": len(interventions),
            "inflation_factor": round(inflation_factor, 6),
            "bankruptcies": len(bankruptcies),
            "events": [e.get("id") for e in events],
            "market_prices": market_prices,
        }
        
        await db.economic_snapshots.insert_one(snapshot)
        
        # Log summary
        logger.info("✅ TICK COMPLETE:")
        logger.info(f"   📊 Businesses: {businesses_processed}")
        logger.info(f"   💰 Tax: {total_tax_collected:.4f} TON")
        logger.info(f"   🔧 Maintenance: {total_maintenance_collected:.4f} TON")
        logger.info(f"   📈 Inflation: {inflation_factor:.4f}x")
        logger.info(f"   ⚠️ Bankruptcies: {len(bankruptcies)}")
        logger.info(f"   🎲 Events: {len(events)}")
        
        # Send consolidated Telegram notifications for low resources
        try:
            pending_notifs = await db.notifications.find(
                {"type": "low_resource", "read": False, "tg_sent": {"$ne": True}},
                {"_id": 0}
            ).to_list(100)
            
            user_notifs = {}
            for n in pending_notifs:
                uid = n.get("user_id", "")
                if uid not in user_notifs:
                    user_notifs[uid] = []
                user_notifs[uid].append(n)
            
            for uid, notifs in user_notifs.items():
                chat_id = await get_user_telegram_chat_id(db, uid)
                if not chat_id:
                    continue
                lines = ["⚠️ <b>Заканчиваются ресурсы!</b>\n"]
                for n in notifs:
                    lines.append(f"• {n.get('message', '')}")
                lines.append(f"\nПополните запасы на маркетплейсе!")
                try:
                    from telegram_bot import get_telegram_bot
                    tg_bot = get_telegram_bot()
                    if tg_bot:
                        keyboard = {"inline_keyboard": [[
                            {"text": "🎮 Открыть игру", "url": "https://ton-builder.preview.emergentagent.com/trading"}
                        ]]}
                        await tg_bot.send_message(chat_id, "\n".join(lines), reply_markup=keyboard)
                        for n in notifs:
                            await db.notifications.update_one({"id": n["id"]}, {"$set": {"tg_sent": True}})
                except Exception as tg_err:
                    logger.debug(f"TG notification failed: {tg_err}")
        except Exception as e:
            logger.debug(f"TG notifications batch: {e}")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ ECONOMIC TICK FAILED: {e}")
        import traceback
        logger.error(traceback.format_exc())


# ==================== MIDNIGHT DECAY ====================

async def midnight_decay():
    """
    Apply 10% decay to all inventories at 00:00 MSK (21:00 UTC).
    Stimulates daily sales and market activity.
    """
    try:
        logger.info("🌙 === MIDNIGHT DECAY STARTED ===")
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        users_cursor = db.users.find({"resources": {"$exists": True}})
        decayed_count = 0
        total_lost = {}
        
        async for user in users_cursor:
            resources = user.get("resources", {})
            if not resources:
                continue
            
            new_resources = {}
            for resource, amount in resources.items():
                if isinstance(amount, (int, float)) and amount > 0:
                    lost = int(amount * MIDNIGHT_DECAY_RATE)
                    new_resources[resource] = max(0, amount - lost)
                    total_lost[resource] = total_lost.get(resource, 0) + lost
                else:
                    new_resources[resource] = amount
            
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"resources": new_resources}}
            )
            decayed_count += 1
        
        # Log
        logger.info(f"🌙 Decay applied to {decayed_count} users")
        for r, lost in total_lost.items():
            if lost > 0:
                logger.info(f"   🔻 {r}: -{lost}")
        
        # Save decay event
        await db.system_events.insert_one({
            "type": "midnight_decay",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "users_affected": decayed_count,
            "resources_lost": total_lost,
        })
        
        # === TECH UMBRELLA DAILY RENT (50 $CITY/day) ===
        try:
            tech_contracts = await db.contracts.find({"type": "tech_umbrella", "status": "active"}).to_list(100)
            rent_processed = 0
            for tc in tech_contracts:
                vassal_id = tc.get("vassal_id")
                patron_id = tc.get("patron_id")
                if not vassal_id or not patron_id:
                    continue
                rent_city = 50  # Fixed rent: 50 $CITY/day
                rent_ton = rent_city / 1000.0
                
                # Deduct from vassal
                vassal = await db.users.find_one(
                    {"$or": [{"id": vassal_id}, {"wallet_address": vassal_id}]},
                    {"_id": 0, "balance_ton": 1}
                )
                if vassal and vassal.get("balance_ton", 0) >= rent_ton:
                    await db.users.update_one(
                        {"$or": [{"id": vassal_id}, {"wallet_address": vassal_id}]},
                        {"$inc": {"balance_ton": -rent_ton}}
                    )
                    await db.users.update_one(
                        {"$or": [{"id": patron_id}, {"wallet_address": patron_id}]},
                        {"$inc": {"balance_ton": rent_ton}}
                    )
                    await db.contracts.update_one(
                        {"id": tc["id"]},
                        {"$inc": {"total_patron_income": rent_city}}
                    )
                    rent_processed += 1
                else:
                    # Violation - can't pay rent
                    v_days = list(tc.get("violation_days", []))
                    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                    if today_str not in v_days:
                        v_days.append(today_str)
                    await db.contracts.update_one(
                        {"id": tc["id"]},
                        {"$set": {"violation_days": v_days}}
                    )
            
            if rent_processed > 0:
                logger.info(f"🛡️ Tech Umbrella rent: {rent_processed} contracts, 50 $CITY/day each")
        except Exception as e:
            logger.error(f"❌ Tech Umbrella rent error: {e}")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ MIDNIGHT DECAY FAILED: {e}")


# ==================== DURABILITY WEAR ====================

async def apply_global_durability_wear():
    """Apply durability wear to ALL businesses in a single global tick.
    V4: Applies T3 resource buff (wear_reduction) per owner.
    """
    try:
        logger.info("🔧 Applying global durability wear...")
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        now = datetime.now(timezone.utc)
        
        businesses = await db.businesses.find(
            {"paused_reason": {"$ne": "bankruptcy"}, "durability": {"$gt": 0}},
            {"_id": 0, "id": 1, "business_type": 1, "level": 1, "durability": 1, "owner": 1, "last_wear_update": 1, "last_tick": 1}
        ).to_list(length=None)
        
        # Cache owner wear reduction buffs
        owner_wear_mult = {}
        
        async def get_owner_wear_mult(owner_id):
            if owner_id in owner_wear_mult:
                return owner_wear_mult[owner_id]
            user = await db.users.find_one(
                {"$or": [{"id": owner_id}, {"wallet_address": owner_id}]},
                {"_id": 0, "active_resource_buffs": 1}
            )
            mult = 1.0
            if user:
                for b in (user.get("active_resource_buffs") or []):
                    if b.get("effect_type") == "wear_reduction" and b.get("expires_at"):
                        try:
                            exp = datetime.fromisoformat(b["expires_at"].replace('Z', '+00:00'))
                            if exp > now:
                                mult = min(mult, b["effect_value"])  # e.g. 0.75
                        except (ValueError, TypeError):
                            pass
            owner_wear_mult[owner_id] = mult
            return mult
        
        updates = []
        for biz in businesses:
            btype = biz.get("business_type", "")
            level = biz.get("level", 1)
            cur = biz.get("durability", 100)
            if cur <= 0:
                continue
            
            last_update = biz.get("last_wear_update") or biz.get("last_tick")
            hours_passed = 1.0
            if last_update:
                try:
                    last_dt = datetime.fromisoformat(str(last_update).replace('Z', '+00:00'))
                    hours_passed = (now - last_dt).total_seconds() / 3600
                except (ValueError, TypeError):
                    hours_passed = 1.0
            
            canonical = BUSINESS_KEY_MAP.get(btype, btype)
            if canonical not in BUSINESSES and btype not in BUSINESSES:
                continue
            
            daily_wear = get_daily_wear(canonical, level)
            wear = daily_wear * 100 * (hours_passed / 24.0)
            
            # Apply owner's wear reduction buff
            owner = biz.get("owner", "")
            if owner:
                wmult = await get_owner_wear_mult(owner)
                wear *= wmult
            
            new_dur = max(0, cur - wear)
            updates.append({"id": biz["id"], "durability": round(new_dur, 2)})
        
        # Bulk write
        if updates:
            from pymongo import UpdateOne
            ops = [UpdateOne({"id": u["id"]}, {"$set": {"durability": u["durability"], "last_wear_update": now.isoformat()}}) for u in updates]
            await db.businesses.bulk_write(ops)
        
        logger.info(f"🔧 Global wear: {len(updates)} businesses updated (cached {len(owner_wear_mult)} owners)")
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Durability wear failed: {e}")


# ==================== BACKWARD COMPATIBLE FUNCTIONS ====================

async def calculate_business_income(business_type: str, level: int, connections: int) -> dict:
    """Backward compatible income calculation using new data"""
    production = get_production(business_type, level)
    consumption = get_consumption(business_type, level)
    config = BUSINESSES.get(business_type, {})
    tier = config.get("tier", 1)
    
    connection_mult = 1 + connections * 0.1
    
    # Base market price for the produced resource
    produces = config.get("produces", "")
    from business_config import RESOURCE_TYPES as RT
    base_price = RT.get(produces, {}).get("base_price", 0.01)
    
    gross_value = production * base_price * connection_mult
    tax_rate = TIER_TAXES.get(tier, 0.15)
    maintenance = MAINTENANCE_COSTS.get(tier, {}).get(level, 0.05)
    
    net = gross_value * (1 - tax_rate) - maintenance
    
    return {
        "gross": round(gross_value, 4),
        "operating_cost": round(maintenance, 4),
        "tax": round(gross_value * tax_rate, 4),
        "net": round(net, 4),
    }


async def auto_collect_income():
    """Run the full economic tick (backward compatible wrapper)"""
    await economic_tick()


# ==================== SCHEDULER ====================

# ==================== CREDIT PROCESSING ====================

async def process_credits():
    """
    Daily credit processing:
    1. Deduct salary percentage from income for active credits
    2. Detect overdue credits (no payment in specified days)
    3. Double rate for overdue credits
    4. Seize businesses after 7 days of non-payment
    """
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        now = datetime.now(timezone.utc)
        active_credits = await db.credits.find(
            {"status": {"$in": ["active", "overdue"]}},
            {"_id": 0}
        ).to_list(500)
        
        logger.info(f"💰 Processing {len(active_credits)} active credits...")
        
        for credit in active_credits:
            credit_id = credit["id"]
            borrower_id = credit.get("borrower_id", "")
            borrower_wallet = credit.get("borrower_wallet", "")
            remaining = credit.get("remaining", 0)
            deduction_pct = credit.get("salary_deduction_percent", 0.10)
            
            if remaining <= 0:
                await db.credits.update_one({"id": credit_id}, {"$set": {"status": "paid", "remaining": 0}})
                continue
            
            # Find borrower
            borrower = await db.users.find_one(
                {"$or": [{"id": borrower_id}, {"wallet_address": borrower_wallet}]},
                {"_id": 0}
            )
            if not borrower:
                continue
            
            # Calculate daily payment from income
            balance = borrower.get("balance_ton", 0)
            daily_income = borrower.get("total_income", 0) / max(1, (now - datetime.fromisoformat(borrower.get("created_at", now.isoformat()).replace("Z", "+00:00"))).days or 1)
            
            # Calculate payment amount
            payment = round(daily_income * deduction_pct, 4)
            
            # If overdue and doubled rate active, double the payment
            if credit.get("is_doubled_rate"):
                payment *= 2
            
            # Limit payment to available balance and remaining debt
            payment = min(payment, balance, remaining)
            
            if payment > 0.0001:
                # Deduct from borrower
                user_filter = {"id": borrower_id} if borrower_id else {"wallet_address": borrower_wallet}
                await db.users.update_one(user_filter, {"$inc": {"balance_ton": -payment}})
                
                new_remaining = round(remaining - payment, 4)
                new_paid = round(credit.get("paid", 0) + payment, 4)
                
                update_set = {
                    "remaining": max(0, new_remaining),
                    "paid": new_paid,
                    "last_payment": now.isoformat(),
                }
                
                if new_remaining <= 0:
                    update_set["status"] = "paid"
                    update_set["remaining"] = 0
                
                await db.credits.update_one({"id": credit_id}, {"$set": update_set})
                
                # Pay to lender if bank
                if credit.get("lender_type") == "bank" and credit.get("lender_id"):
                    await db.users.update_one(
                        {"$or": [{"id": credit["lender_id"]}, {"wallet_address": credit["lender_id"]}]},
                        {"$inc": {"balance_ton": payment}}
                    )
                
                logger.info(f"  Credit {credit_id[:8]}: payment {payment:.4f} TON, remaining {new_remaining:.2f}")
            
            # Check overdue status
            last_payment = credit.get("last_payment")
            overdue_days = credit.get("overdue_penalty_days", 3)
            
            if last_payment:
                try:
                    lp = datetime.fromisoformat(last_payment.replace("Z", "+00:00"))
                    days_since = (now - lp).days
                except Exception:
                    days_since = 0
            else:
                created = credit.get("created_at", now.isoformat())
                try:
                    cr = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    days_since = (now - cr).days
                except Exception:
                    days_since = 0
            
            # Activate doubled rate after overdue_penalty_days
            if days_since >= overdue_days and not credit.get("is_doubled_rate") and payment < 0.0001:
                await db.credits.update_one({"id": credit_id}, {"$set": {
                    "status": "overdue",
                    "is_doubled_rate": True,
                    "overdue_since": credit.get("overdue_since") or now.isoformat(),
                }})
                logger.warning(f"  ⚠️ Credit {credit_id[:8]}: OVERDUE - doubled rate activated")
                
                # Send notification
                await db.notifications.insert_one({
                    "user_id": borrower_id,
                    "type": "credit_overdue",
                    "message": f"Кредит просрочен! Ставка удвоена. Погасите долг {remaining:.2f} TON.",
                    "created_at": now.isoformat(),
                    "read": False,
                })
            
            # Seize business after 7 days of non-payment
            overdue_since = credit.get("overdue_since")
            if overdue_since:
                try:
                    os_dt = datetime.fromisoformat(overdue_since.replace("Z", "+00:00"))
                    overdue_total_days = (now - os_dt).days
                except Exception:
                    overdue_total_days = 0
                
                if overdue_total_days >= 7 and credit.get("status") == "overdue":
                    # SEIZE BUSINESS
                    biz_id = credit.get("collateral_business_id")
                    business = await db.businesses.find_one({"id": biz_id}, {"_id": 0})
                    
                    if business:
                        lender_type = credit.get("lender_type", "government")
                        lender_id = credit.get("lender_id", "government")
                        
                        if lender_type == "government":
                            # Auto-sell at -20%
                            collateral_value = credit.get("collateral_value", 0)
                            sale_price = round(collateral_value * 0.80, 2)
                            
                            await db.businesses.update_one({"id": biz_id}, {"$set": {
                                "owner": "government",
                                "owner_wallet": "government",
                                "for_sale": True,
                                "sale_price": sale_price,
                                "seized_from": borrower_id,
                                "seized_at": now.isoformat(),
                            }})
                            
                            # Also list on land marketplace if plot exists
                            plot_id = business.get("plot_id")
                            if plot_id:
                                plot = await db.plots.find_one({"id": plot_id}, {"_id": 0})
                                if plot:
                                    listing_id = str(uuid.uuid4())
                                    listing = {
                                        "id": listing_id,
                                        "plot_id": plot_id,
                                        "city_id": plot.get("island_id", "ton_island"),
                                        "city_name": "TON Island",
                                        "x": plot.get("x", 0),
                                        "y": plot.get("y", 0),
                                        "seller_id": "government",
                                        "seller_wallet": "government",
                                        "seller_username": "Государство",
                                        "price": sale_price,
                                        "business": {
                                            "id": biz_id,
                                            "type": business.get("type"),
                                            "level": business.get("level", 1),
                                            "tier": business.get("tier", 1)
                                        },
                                        "status": "active",
                                        "is_seized": True,
                                        "seized_from": borrower_id,
                                        "created_at": now.isoformat()
                                    }
                                    await db.land_listings.insert_one(listing)
                                    
                                    # Update plot owner to government
                                    await db.plots.update_one({"id": plot_id}, {"$set": {
                                        "owner": "government",
                                        "owner_wallet": "government",
                                        "seized_from": borrower_id
                                    }})
                                    
                                    logger.warning(f"  📢 Land listing created for seized business at {sale_price} TON")
                            
                            logger.warning(f"  🏛️ Business {biz_id[:8]} SEIZED by government, listed at {sale_price} TON")
                        else:
                            # Transfer to bank owner
                            await db.businesses.update_one({"id": biz_id}, {"$set": {
                                "owner": lender_id,
                                "owner_wallet": lender_id,
                                "seized_from": borrower_id,
                                "seized_at": now.isoformat(),
                            }})
                            
                            logger.warning(f"  🏦 Business {biz_id[:8]} SEIZED by bank owner {lender_id[:8]}")
                        
                        # Mark credit as seized
                        await db.credits.update_one({"id": credit_id}, {"$set": {
                            "status": "seized",
                            "remaining": 0,
                            "seized_at": now.isoformat(),
                        }})
                        
                        # Notify borrower
                        await db.notifications.insert_one({
                            "user_id": borrower_id,
                            "type": "business_seized",
                            "message": "Ваш бизнес конфискован за неуплату кредита!",
                            "created_at": now.isoformat(),
                            "read": False,
                        })
        
        logger.info("✅ Credit processing complete")
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Credit processing error: {e}")


# ==================== WAREHOUSE SPOILAGE ====================

async def process_warehouse_spoilage():
    """
    Daily warehouse spoilage:
    If user's total warehouse usage exceeds capacity,
    50% of the overflow is destroyed each day.
    """
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        now = datetime.now(timezone.utc)
        
        # Get all users with businesses
        users = await db.users.find({}, {"_id": 0, "id": 1, "wallet_address": 1, "username": 1}).to_list(1000)
        
        spoiled_count = 0
        
        for user in users:
            uid = user.get("id", "")
            wallet = user.get("wallet_address", "")
            
            # Get businesses
            or_q = [{"owner": uid}]
            if wallet:
                or_q.append({"owner": wallet})
            
            businesses = await db.businesses.find({"$or": or_q}, {"_id": 0}).to_list(50)
            if not businesses:
                continue
            
            # Calculate total capacity and usage
            total_capacity = 0
            total_used = 0
            biz_items = []  # [(biz_id, resource, amount)]
            
            for biz in businesses:
                storage = biz.get("storage", {})
                total_capacity += storage.get("capacity", 0)
                items = storage.get("items", {})
                for resource, amount in items.items():
                    amt = int(amount)
                    if amt > 0:
                        total_used += amt
                        biz_items.append((biz["id"], resource, amt))
            
            overflow = total_used - total_capacity
            if overflow <= 0:
                continue
            
            # 50% of overflow is destroyed
            spoilage = int(overflow * 0.5)
            if spoilage <= 0:
                continue
            
            # Distribute spoilage proportionally across items
            remaining_spoil = spoilage
            for biz_id, resource, amount in sorted(biz_items, key=lambda x: -x[2]):
                if remaining_spoil <= 0:
                    break
                destroy = min(remaining_spoil, amount)
                await db.businesses.update_one(
                    {"id": biz_id},
                    {"$inc": {f"storage.items.{resource}": -destroy}}
                )
                remaining_spoil -= destroy
            
            spoiled_count += 1
            logger.info(f"  🗑️ User {user.get('username', uid[:8])}: spoiled {spoilage} units (overflow: {overflow})")
            
            # Notify user
            await db.notifications.insert_one({
                "user_id": uid,
                "type": "warehouse_spoilage",
                "message": f"Склад переполнен! Испорчено {spoilage} единиц товара.",
                "created_at": now.isoformat(),
                "read": False,
            })
        
        logger.info(f"✅ Warehouse spoilage: {spoiled_count} users affected")
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Warehouse spoilage error: {e}")


# ==================== NOTIFICATIONS SENDER ====================

async def send_pending_notifications():
    """Send pending notifications via Telegram"""
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Get unread notifications for users with Telegram
        notifications = await db.notifications.find(
            {"read": False, "telegram_sent": {"$ne": True}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        if not notifications:
            client.close()
            return
        
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        if not bot_token:
            client.close()
            return
        
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            for notif in notifications:
                user_id = notif.get("user_id", "")
                user = await db.users.find_one(
                    {"$or": [{"id": user_id}, {"wallet_address": user_id}]},
                    {"_id": 0}
                )
                if not user or not user.get("telegram_username"):
                    continue
                
                # Get chat_id from stored mapping
                tg_mapping = await db.telegram_mappings.find_one(
                    {"username": user.get("telegram_username")},
                    {"_id": 0}
                )
                if not tg_mapping or not tg_mapping.get("chat_id"):
                    continue
                
                chat_id = tg_mapping["chat_id"]
                message = f"🏙️ TON City\n\n{notif.get('message', '')}"
                
                try:
                    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                    await session.post(url, json={
                        "chat_id": chat_id,
                        "text": message,
                        "parse_mode": "HTML"
                    })
                    
                    await db.notifications.update_one(
                        {"user_id": user_id, "created_at": notif["created_at"]},
                        {"$set": {"telegram_sent": True}}
                    )
                except Exception as e:
                    logger.error(f"Telegram send error: {e}")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Notification sender error: {e}")


async def send_withdrawal_unlock_notifications():
    """Send Telegram notifications when withdrawal lock expires"""
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        now = datetime.now(timezone.utc)
        
        # Find scheduled notifications that are due and not sent
        scheduled = await db.scheduled_notifications.find({
            "type": "withdrawal_unlocked",
            "sent": False,
            "scheduled_at": {"$lte": now.isoformat()}
        }).to_list(100)
        
        if not scheduled:
            client.close()
            return
        
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        if not bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN not set, skipping withdrawal unlock notifications")
            client.close()
            return
        
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            for notif in scheduled:
                user_id = notif.get("user_id")
                user = await db.users.find_one(
                    {"$or": [{"id": user_id}, {"wallet_address": user_id}]},
                    {"_id": 0}
                )
                
                if not user:
                    await db.scheduled_notifications.update_one(
                        {"_id": notif.get("_id")},
                        {"$set": {"sent": True, "error": "user_not_found"}}
                    )
                    continue
                
                # Get telegram chat_id
                tg_username = user.get("telegram_username")
                if not tg_username:
                    await db.scheduled_notifications.update_one(
                        {"_id": notif.get("_id")},
                        {"$set": {"sent": True, "error": "no_telegram"}}
                    )
                    continue
                
                tg_mapping = await db.telegram_mappings.find_one(
                    {"username": tg_username},
                    {"_id": 0}
                )
                
                if not tg_mapping or not tg_mapping.get("chat_id"):
                    await db.scheduled_notifications.update_one(
                        {"_id": notif.get("_id")},
                        {"$set": {"sent": True, "error": "no_chat_id"}}
                    )
                    continue
                
                chat_id = tg_mapping["chat_id"]
                message = "🔓 <b>Вывод средств разблокирован!</b>\n\nБлокировка после изменения настроек 2FA снята. Теперь вы можете выводить средства."
                
                try:
                    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                    resp = await session.post(url, json={
                        "chat_id": chat_id,
                        "text": message,
                        "parse_mode": "HTML"
                    })
                    
                    await db.scheduled_notifications.update_one(
                        {"_id": notif.get("_id")},
                        {"$set": {"sent": True, "sent_at": now.isoformat()}}
                    )
                    
                    logger.info(f"✅ Withdrawal unlock notification sent to user {user_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to send withdrawal unlock notification: {e}")
                    await db.scheduled_notifications.update_one(
                        {"_id": notif.get("_id")},
                        {"$set": {"error": str(e)}}
                    )
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Withdrawal unlock notification error: {e}")


def init_scheduler():
    """Initialize APScheduler with all background tasks"""
    global scheduler
    
    scheduler = AsyncIOScheduler()
    
    # Main economic tick - every minute
    scheduler.add_job(
        economic_tick,
        trigger=IntervalTrigger(minutes=1),
        id="economic_tick",
        name="Economic Tick (Every Minute)",
        replace_existing=True,
    )
    
    # Midnight decay - daily at 21:00 UTC (00:00 MSK)
    scheduler.add_job(
        midnight_decay,
        trigger=CronTrigger(hour=21, minute=0),
        id="midnight_decay",
        name="Midnight Decay (00:00 MSK)",
        replace_existing=True,
    )
    
    # Durability wear - every 6 hours (as backup, main wear happens in tick)
    scheduler.add_job(
        apply_global_durability_wear,
        trigger=IntervalTrigger(hours=6),
        id="durability_wear",
        name="Durability Wear Check",
        replace_existing=True,
    )
    
    # Credit processing - daily at 22:00 UTC (01:00 MSK)
    scheduler.add_job(
        process_credits,
        trigger=CronTrigger(hour=22, minute=0),
        id="credit_processing",
        name="Credit Processing Daily",
        replace_existing=True,
    )
    
    # Warehouse spoilage - daily at 21:30 UTC (00:30 MSK)
    scheduler.add_job(
        process_warehouse_spoilage,
        trigger=CronTrigger(hour=21, minute=30),
        id="warehouse_spoilage",
        name="Warehouse Spoilage Daily",
        replace_existing=True,
    )
    
    # Notification sender - every 5 minutes
    scheduler.add_job(
        send_pending_notifications,
        trigger=IntervalTrigger(minutes=5),
        id="notification_sender",
        name="Notification Sender",
        replace_existing=True,
    )
    
    # Withdrawal unlock notifications - every 1 minute (for testing)
    scheduler.add_job(
        send_withdrawal_unlock_notifications,
        trigger=IntervalTrigger(minutes=1),
        id="withdrawal_unlock_notifications",
        name="Withdrawal Unlock Notifications",
        replace_existing=True,
    )
    
    # Auto-withdrawal processor - every 10 minutes
    scheduler.add_job(
        process_auto_withdrawals,
        trigger=IntervalTrigger(minutes=10),
        id="auto_withdrawal_processor",
        name="Auto Withdrawal Processor",
        replace_existing=True,
    )
    
    logger.info("✅ Scheduler initialized with V2.0 economic engine")
    logger.info("📅 Economic Tick: Every 1 minute")
    logger.info("📅 Midnight Decay: Daily at 21:00 UTC (00:00 MSK)")
    logger.info("📅 Durability Wear: Every 6 hours")
    logger.info("📅 Credit Processing: Daily at 22:00 UTC")
    logger.info("📅 Warehouse Spoilage: Daily at 21:30 UTC")
    logger.info("📅 Notifications: Every 5 minutes")
    logger.info("📅 Auto Withdrawals: Every 10 minutes")
    
    return scheduler


def start_scheduler():
    """Start the scheduler"""
    global scheduler
    if scheduler is None:
        init_scheduler()
    if not scheduler.running:
        scheduler.start()
        logger.info("🚀 Scheduler started")


def shutdown_scheduler():
    """Shutdown the scheduler"""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("🛑 Scheduler stopped")


async def trigger_auto_collection_now():
    """Manually trigger economic tick"""
    logger.info("🔧 Manual economic tick triggered...")
    await economic_tick()


async def process_auto_withdrawals():
    """
    Auto-process withdrawals:
    1. Instant withdrawals: process immediately when pending
    2. Standard withdrawals: auto-approve after 24 hours if admin hasn't acted
    """
    try:
        logger.info("💸 === AUTO WITHDRAWAL PROCESSOR STARTED ===")
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        now = datetime.now(timezone.utc)
        hours_24_ago = now - timedelta(hours=24)
        
        # Get withdrawal wallet mnemonic
        withdrawal_wallet = await db.admin_settings.find_one({"type": "withdrawal_wallet"}, {"_id": 0})
        seed = withdrawal_wallet.get("mnemonic") if withdrawal_wallet else None
        
        if not seed:
            sender_wallet = await db.admin_settings.find_one({"type": "sender_wallet"}, {"_id": 0})
            seed = sender_wallet.get("mnemonic") if sender_wallet else None
        
        if not seed:
            seed = os.environ.get("TON_WALLET_MNEMONIC")
        
        if not seed:
            logger.warning("💸 No withdrawal wallet configured - skipping auto withdrawals")
            await client.close()
            return
        
        # 1. Process instant withdrawals (process immediately)
        instant_pending = await db.transactions.find({
            "tx_type": "instant_withdrawal",
            "status": "pending"
        }, {"_id": 0}).to_list(50)
        
        logger.info(f"💸 Found {len(instant_pending)} instant withdrawals to process")
        
        for tx in instant_pending:
            await process_single_withdrawal(db, tx, seed)
        
        # 2. Process standard withdrawals older than 24 hours
        standard_pending = await db.transactions.find({
            "tx_type": {"$in": ["withdrawal", None]},
            "type": "withdrawal",
            "status": "pending",
            "created_at": {"$lte": hours_24_ago.isoformat()}
        }, {"_id": 0}).to_list(50)
        
        logger.info(f"💸 Found {len(standard_pending)} standard withdrawals older than 24h")
        
        for tx in standard_pending:
            await process_single_withdrawal(db, tx, seed)
        
        await client.close()
        logger.info("💸 === AUTO WITHDRAWAL PROCESSOR COMPLETED ===")
        
    except Exception as e:
        logger.error(f"❌ Error in auto withdrawal processor: {e}")


async def process_single_withdrawal(db, tx: dict, seed: str):
    """Process a single withdrawal with double-send protection"""
    tx_id = tx.get("id")
    
    try:
        # Atomic lock to prevent double processing
        result = await db.transactions.find_one_and_update(
            {"id": tx_id, "status": "pending"},
            {"$set": {"status": "processing", "auto_processing_started": datetime.now(timezone.utc).isoformat()}},
            return_document=True
        )
        
        if not result:
            logger.info(f"💸 Withdrawal {tx_id} already being processed or completed")
            return
        
        user_wallet = tx.get("user_wallet")
        user = await db.users.find_one({"wallet_address": user_wallet}, {"_id": 0})
        
        # Determine destination address
        destination = None
        if user:
            destination = user.get("raw_address") or user.get("wallet_address")
        if not destination:
            destination = tx.get("user_raw_address") or tx.get("to_address") or user_wallet
        
        if not destination:
            logger.error(f"❌ No destination address for withdrawal {tx_id}")
            await db.transactions.update_one({"id": tx_id}, {"$set": {"status": "failed", "error": "No destination"}})
            return
        
        net_amount = float(tx.get("net_amount", 0))
        commission = float(tx.get("commission", 0))
        amount_ton_original = float(tx.get("amount_ton", 0)) or (net_amount + commission)
        
        user_username = user.get("username", "") if user else ""
        
        # Import ton_integration dynamically
        try:
            from ton_integration import TonIntegration
            ton_client = TonIntegration()
            
            tx_hash = await ton_client.send_ton_payout(
                dest_address=destination,
                amount_ton=net_amount,
                mnemonics=seed,
                user_username=user_username
            )
            
            # Success
            now_iso = datetime.now(timezone.utc).isoformat()
            await db.transactions.update_one(
                {"id": tx_id},
                {"$set": {
                    "status": "completed",
                    "completed_at": now_iso,
                    "blockchain_hash": tx_hash,
                    "auto_processed": True
                }}
            )
            
            # Update stats
            await db.admin_stats.update_one(
                {"type": "treasury"},
                {"$inc": {"withdrawal_fees": commission, "total_withdrawals": net_amount, "total_withdrawals_count": 1}},
                upsert=True
            )
            
            logger.info(f"✅ Auto-withdrawal {tx_id} completed: {net_amount} TON to {destination[:20]}...")
            
        except Exception as e:
            logger.error(f"❌ Blockchain error for withdrawal {tx_id}: {e}")
            # Return funds
            await db.users.update_one(
                {"wallet_address": user_wallet},
                {"$inc": {"balance_ton": amount_ton_original}}
            )
            await db.transactions.update_one(
                {"id": tx_id},
                {"$set": {"status": "failed", "error": str(e), "auto_processed": True}}
            )
            
    except Exception as e:
        logger.error(f"❌ Error processing withdrawal {tx_id}: {e}")
