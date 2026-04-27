"""
TON-City Game Systems V2.0 - Complete Economic Engine
Implements: Production Ticks, Patronage, Durability, Warehouses, Banking,
Taxes, NPC Interventions, Midnight Decay, Anti-Monopoly, Inflation
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
import uuid
import random
import math
import logging

from business_config import (
    BUSINESSES, TIER_TAXES, PATRON_BONUSES, RESOURCE_TYPES, RESOURCE_WEIGHTS,
    WAREHOUSE_CONFIG, PATRON_TAX_RATE, INSTANT_WITHDRAWAL_FEE, TURNOVER_TAX_RATE,
    NPC_PRICE_FLOOR, NPC_PRICE_CEILING, MONOPOLY_THRESHOLD, MIDNIGHT_DECAY_RATE,
    MAINTENANCE_COSTS, BUSINESS_LEVELS, MIN_PRICE_TON,
    get_production, get_consumption, get_consumption_breakdown,
    calculate_effective_production, calculate_effective_income,
    calculate_upgrade_cost, get_daily_wear, get_storage_capacity,
    get_expansion_slot_capacity, get_patron_bonus, check_resource_requirements,
    calculate_repair_cost, UPGRADE_COST_MULTIPLIER,
)

logger = logging.getLogger(__name__)


# ==================== USER RESOURCE-BUFF HELPER ====================

def get_user_production_buff(user_doc: dict) -> float:
    """
    Returns the production multiplier from a user's currently active resource buffs
    (e.g. neuro_core +8% → 1.08). Multiple production_multiplier buffs stack.
    Expired entries are skipped silently.
    """
    if not user_doc:
        return 1.0
    buffs = user_doc.get("active_resource_buffs") or []
    if not buffs:
        return 1.0
    now = datetime.now(timezone.utc)
    mult = 1.0
    for b in buffs:
        if not isinstance(b, dict):
            continue
        if b.get("effect_type") != "production_multiplier":
            continue
        exp_raw = b.get("expires_at")
        if not exp_raw:
            continue
        try:
            exp = datetime.fromisoformat(str(exp_raw).replace('Z', '+00:00'))
        except (ValueError, TypeError):
            continue
        if exp <= now:
            continue
        try:
            mult *= float(b.get("effect_value", 1.0))
        except (TypeError, ValueError):
            continue
    return mult


# ==================== PATRONAGE SYSTEM ====================

class PatronageSystem:
    """Handles patron-vassal relationships and bonuses"""
    
    PATRON_CHANGE_COOLDOWN_DAYS = 7
    
    @staticmethod
    def can_be_patron(business_type: str) -> bool:
        config = BUSINESSES.get(business_type, {})
        return config.get("is_patron", False)
    
    @staticmethod
    def get_patron_type(business_type: str) -> Optional[str]:
        config = BUSINESSES.get(business_type, {})
        return config.get("patron_type")
    
    @staticmethod
    def can_change_patron(last_change: Optional[str]) -> Tuple[bool, int]:
        if not last_change:
            return True, 0
        try:
            last_dt = datetime.fromisoformat(last_change.replace('Z', '+00:00'))
            cooldown_end = last_dt + timedelta(days=PatronageSystem.PATRON_CHANGE_COOLDOWN_DAYS)
            now = datetime.now(timezone.utc)
            if now >= cooldown_end:
                return True, 0
            remaining = (cooldown_end - now).days
            return False, remaining
        except (ValueError, TypeError):
            return True, 0
    
    @staticmethod
    def calculate_patron_tax(income: float) -> float:
        return round(income * PATRON_TAX_RATE, 6)
    
    @staticmethod
    def get_patron_bonus_multiplier(patron_type: str, patron_level: int, bonus_type: str) -> float:
        return get_patron_bonus(patron_type, patron_level, bonus_type)


# ==================== BUSINESS ECONOMICS ====================

class BusinessEconomics:
    """Handles business upgrades, durability, and production with exact data tables"""
    
    MAX_LEVEL = 10
    
    @staticmethod
    def can_upgrade(business: dict) -> Tuple[bool, Optional[dict]]:
        current_level = business.get("level", 1)
        if current_level >= BusinessEconomics.MAX_LEVEL:
            return False, None
        business_type = business.get("business_type")
        cost = calculate_upgrade_cost(business_type, current_level)
        return True, cost
    
    @staticmethod
    def upgrade_business(business: dict) -> dict:
        new_level = min(business.get("level", 1) + 1, BusinessEconomics.MAX_LEVEL)
        business_type = business.get("business_type")
        return {
            "level": new_level,
            "storage.capacity": get_storage_capacity(business_type, new_level),
            "upgraded_at": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def apply_wear(business: dict, hours_passed: float) -> dict:
        """Apply durability wear based on time passed"""
        business_type = business.get("business_type")
        level = business.get("level", 1)
        current_durability = business.get("durability", 100)
        
        daily_wear = get_daily_wear(business_type, level)
        # Wear per hour = daily_wear / 24, in percentage points (0-100)
        wear = daily_wear * 100 * (hours_passed / 24.0)
        
        new_durability = max(0, current_durability - wear)
        
        return {
            "durability": round(new_durability, 2),
            "last_wear_update": datetime.now(timezone.utc).isoformat(),
            "wear_applied": round(wear, 2),
        }
    
    @staticmethod
    def get_repair_cost(business: dict) -> dict:
        business_type = business.get("business_type")
        level = business.get("level", 1)
        current_durability = business.get("durability", 100)
        missing = 100 - current_durability
        return calculate_repair_cost(business_type, level, missing)
    
    @staticmethod
    def is_producing(business: dict) -> bool:
        return business.get("durability", 100) > 0
    
    @staticmethod
    def calculate_effective_production(business: dict, patron_bonus: float = 1.0, user_buff_multiplier: float = 1.0) -> dict:
        """Wrapper: returns tick output for display purposes."""
        return BusinessEconomics.calculate_tick_output(business, patron_bonus, user_buff_multiplier)
    
    @staticmethod
    def calculate_tick_output(business: dict, patron_bonus: float = 1.0, user_buff_multiplier: float = 1.0) -> dict:
        """
        Calculate what a business produces and consumes in one tick.
        Production is proportionally reduced by durability.
        `user_buff_multiplier` reflects active resource buffs (e.g. neuro_core +8%).
        """
        business_type = business.get("business_type")
        level = business.get("level", 1)
        durability = business.get("durability", 100)
        
        config = BUSINESSES.get(business_type, {})
        tier = config.get("tier", 1)
        
        if durability <= 0:
            return {
                "production": 0,
                "produces_resource": config.get("produces"),
                "consumption": {},
                "status": "halted",
                "reason": "durability_zero",
                "durability": 0,
            }
        
        # Production = base * durability_mult * patron_bonus * user_buff_multiplier
        # 50-100% durability = 100%, 5-50% = 80%, 0% = stopped
        raw_production = get_production(business_type, level)
        if durability < 50:
            durability_mult = 0.8
        else:
            durability_mult = 1.0
        effective_production = raw_production * durability_mult * patron_bonus * user_buff_multiplier
        
        # Consumption is NOT affected by durability - you pay full cost
        consumption = get_consumption_breakdown(business_type, level)
        
        return {
            "production": round(effective_production, 2),
            "produces_resource": config.get("produces"),
            "consumption": consumption,
            "total_consumption": get_consumption(business_type, level),
            "durability": durability,
            "durability_mult": round(durability_mult, 4),
            "patron_bonus": patron_bonus,
            "user_buff_multiplier": user_buff_multiplier,
            "tier": tier,
            "tax_rate": TIER_TAXES.get(tier, 0.15),
            "status": "active" if durability > 20 else "warning",
        }


# ==================== WAREHOUSE SYSTEM ====================

class WarehouseSystem:
    """Handles storage limits with overflow protection"""
    
    @staticmethod
    def get_total_capacity(business: dict) -> int:
        """Get total storage capacity including expansion slots"""
        business_type = business.get("business_type")
        level = business.get("level", 1)
        
        base_capacity = get_storage_capacity(business_type, level)
        
        # Add expansion slots
        expansion_slots = business.get("expansion_slots", {})
        extra = 0
        for slot_num, slot_data in expansion_slots.items():
            if slot_data.get("unlocked"):
                extra += get_expansion_slot_capacity(business_type, level, int(slot_num))
        
        return base_capacity + extra
    
    @staticmethod
    def check_storage_space(business: dict, amount: float) -> Tuple[bool, int]:
        """Check if there's enough storage space"""
        capacity = WarehouseSystem.get_total_capacity(business)
        current_stored = business.get("storage", {}).get("current", 0)
        available = capacity - current_stored
        return amount <= available, int(available)
    
    @staticmethod
    def can_unlock_slot(business: dict, slot_number: int) -> Tuple[bool, dict]:
        """Check if expansion slot can be unlocked"""
        level = business.get("level", 1)
        slot_config = WAREHOUSE_CONFIG["expansion_slots"].get(slot_number)
        
        if not slot_config:
            return False, {"reason": "invalid_slot"}
        
        if level < slot_config["unlock_level"]:
            return False, {"reason": f"requires_level_{slot_config['unlock_level']}"}
        
        existing = business.get("expansion_slots", {})
        if str(slot_number) in existing and existing[str(slot_number)].get("unlocked"):
            return False, {"reason": "already_unlocked"}
        
        # Cost
        tier = BUSINESSES.get(business.get("business_type"), {}).get("tier", 1)
        cost = WAREHOUSE_CONFIG["slot_upgrade_costs"].get(tier, {})
        
        return True, {"cost": cost, "extra_capacity_days": slot_config["capacity_days"]}
    
    @staticmethod
    def apply_midnight_decay(inventory: dict) -> dict:
        """Apply 10% decay to all inventory items at midnight"""
        decayed = {}
        for resource, amount in inventory.items():
            lost = int(amount * MIDNIGHT_DECAY_RATE)
            decayed[resource] = max(0, amount - lost)
        return decayed
    
    @staticmethod
    def create_rental_offer(owner_id: str, warehouse_id: str, slots: int, price_per_slot: float) -> dict:
        return {
            "id": str(uuid.uuid4()),
            "owner_id": owner_id,
            "warehouse_id": warehouse_id,
            "slots_available": slots,
            "price_per_slot_per_day": price_per_slot,
            "total_price_per_day": round(slots * price_per_slot, 4),
            "status": "available",
            "created_at": datetime.now(timezone.utc).isoformat()
        }


# ==================== TAX SYSTEM ====================

class TaxSystem:
    """Three-way tax distribution: Treasury, Patron, Player"""
    
    @staticmethod
    def calculate_income_tax(gross_income: float, tier: int, has_patron: bool, is_monopolist: bool = False) -> dict:
        """Calculate income tax split"""
        tax_rate = TIER_TAXES.get(tier, 0.15)
        
        # Double tax for monopolists
        if is_monopolist:
            tax_rate = min(tax_rate * 2, 0.60)  # Cap at 60%
        
        treasury_tax = gross_income * tax_rate
        after_treasury = gross_income - treasury_tax
        
        patron_tax = after_treasury * PATRON_TAX_RATE if has_patron else 0
        player_income = after_treasury - patron_tax
        
        return {
            "gross": round(gross_income, 6),
            "treasury_tax": round(treasury_tax, 6),
            "treasury_rate": tax_rate,
            "patron_tax": round(patron_tax, 6),
            "patron_rate": PATRON_TAX_RATE if has_patron else 0,
            "player_income": round(player_income, 6),
            "is_monopolist": is_monopolist,
            "effective_rate": round((treasury_tax + patron_tax) / gross_income, 4) if gross_income > 0 else 0,
        }
    
    @staticmethod
    def calculate_turnover_tax(trade_amount: float) -> dict:
        """Calculate 2% turnover tax on market transactions"""
        tax = trade_amount * TURNOVER_TAX_RATE
        return {
            "trade_amount": round(trade_amount, 6),
            "tax": round(tax, 6),
            "net_amount": round(trade_amount - tax, 6),
            "rate": TURNOVER_TAX_RATE,
        }
    
    @staticmethod
    def calculate_maintenance(business_type: str, level: int) -> float:
        """Calculate daily maintenance cost in TON"""
        config = BUSINESSES.get(business_type, {})
        tier = config.get("tier", 1)
        return MAINTENANCE_COSTS.get(tier, {}).get(level, 0.05)


# ==================== NPC MARKET SYSTEM ====================

class NPCMarketSystem:
    """Government NPC bot for price stabilization"""
    
    @staticmethod
    def check_price_intervention(resource: str, current_price: float) -> Optional[dict]:
        """
        Check if NPC should intervene.
        Returns action dict or None if no intervention needed.
        """
        resource_config = RESOURCE_TYPES.get(resource)
        if not resource_config:
            return None
        
        base_price = resource_config.get("base_price", 0.01)
        price_ratio = current_price / base_price if base_price > 0 else 1.0
        
        if price_ratio < NPC_PRICE_FLOOR:
            # Price too low - NPC buys to support price
            buy_amount = random.randint(50, 200)
            return {
                "action": "buy",
                "resource": resource,
                "amount": buy_amount,
                "price": base_price * NPC_PRICE_FLOOR,
                "reason": f"Price {price_ratio:.2f}x below floor ({NPC_PRICE_FLOOR}x)",
            }
        
        if price_ratio > NPC_PRICE_CEILING:
            # Price too high - NPC sells reserves
            sell_amount = random.randint(50, 200)
            return {
                "action": "sell",
                "resource": resource,
                "amount": sell_amount,
                "price": base_price * NPC_PRICE_CEILING,
                "reason": f"Price {price_ratio:.2f}x above ceiling ({NPC_PRICE_CEILING}x)",
            }
        
        return None
    
    @staticmethod
    def check_monopoly(player_resource_share: float) -> dict:
        """
        Check if player has monopoly (>40% of resource on market).
        If so, double their sale tax.
        """
        is_monopolist = player_resource_share > MONOPOLY_THRESHOLD
        return {
            "is_monopolist": is_monopolist,
            "market_share": round(player_resource_share, 4),
            "threshold": MONOPOLY_THRESHOLD,
            "sale_tax_multiplier": 2.0 if is_monopolist else 1.0,
        }
    
    @staticmethod
    def calculate_npc_consumption(total_supply: dict) -> dict:
        """
        NPC consumes a small amount of each resource to simulate demand.
        Consumes 1-3% of total supply per tick.
        """
        consumed = {}
        for resource, total in total_supply.items():
            if total > 0:
                rate = random.uniform(0.01, 0.03)
                amount = int(total * rate)
                if amount > 0:
                    consumed[resource] = amount
        return consumed


# ==================== INFLATION SYSTEM ====================

class InflationSystem:
    """Tracks and applies inflation mechanics"""
    
    BASE_INFLATION_RATE = 0.01  # 0.1% base daily inflation
    
    @staticmethod
    def calculate_inflation_factor(total_ton_supply: float, total_ton_sinks: float) -> float:
        """
        Calculate inflation based on money supply vs sinks.
        If more TON enters than leaves, prices go up.
        """
        if total_ton_sinks <= 0:
            return 1.0 + InflationSystem.BASE_INFLATION_RATE
        
        ratio = total_ton_supply / total_ton_sinks
        
        if ratio > 1.5:
            return 1.0 + InflationSystem.BASE_INFLATION_RATE * 3  # High inflation
        elif ratio > 1.0:
            return 1.0 + InflationSystem.BASE_INFLATION_RATE  # Normal inflation
        else:
            return 1.0 - InflationSystem.BASE_INFLATION_RATE * 0.5  # Deflation
    
    @staticmethod
    def apply_price_inflation(current_prices: dict, inflation_factor: float) -> dict:
        """Apply inflation to all resource prices, enforce MIN_PRICE_TON"""
        updated = {}
        for resource, price in current_prices.items():
            new_price = price * inflation_factor
            base = RESOURCE_TYPES.get(resource, {}).get("base_price", MIN_PRICE_TON)
            # Enforce: no price below MIN_PRICE_TON (0.01), no price above 500% of base
            new_price = max(MIN_PRICE_TON, min(new_price, base * 5.0))
            updated[resource] = round(new_price, 8)
        return updated


# ==================== BANKRUPTCY SYSTEM ====================

class BankruptcySystem:
    """Handles bankruptcy checks and business seizure"""
    
    BANKRUPTCY_BALANCE_THRESHOLD = -10.0  # TON
    MAINTENANCE_GRACE_DAYS = 3
    
    @staticmethod
    def check_bankruptcy(user: dict) -> dict:
        """Check if user is bankrupt"""
        balance = user.get("balance_ton", 0)
        unpaid_maintenance_days = user.get("unpaid_maintenance_days", 0)
        
        is_bankrupt = (
            balance < BankruptcySystem.BANKRUPTCY_BALANCE_THRESHOLD or
            unpaid_maintenance_days > BankruptcySystem.MAINTENANCE_GRACE_DAYS
        )
        
        return {
            "is_bankrupt": is_bankrupt,
            "balance": balance,
            "unpaid_days": unpaid_maintenance_days,
            "reason": (
                "negative_balance" if balance < BankruptcySystem.BANKRUPTCY_BALANCE_THRESHOLD
                else "unpaid_maintenance" if unpaid_maintenance_days > BankruptcySystem.MAINTENANCE_GRACE_DAYS
                else None
            ),
        }
    
    @staticmethod
    def handle_bankruptcy(businesses: List[dict]) -> List[dict]:
        """
        Bankrupt user's businesses get paused.
        Returns list of affected businesses.
        """
        affected = []
        for biz in businesses:
            affected.append({
                "business_id": biz.get("id"),
                "business_type": biz.get("business_type"),
                "action": "paused",
                "reason": "owner_bankrupt",
            })
        return affected





class BankingSystem:
    """Handles dual-queue withdrawals and instant withdrawal via banks"""
    
    STANDARD_QUEUE_HOURS = 24
    INSTANT_FEE = 0.01
    
    @staticmethod
    def create_withdrawal_request(user_wallet: str, amount: float, withdrawal_type: str = "standard") -> dict:
        commission = 0.03
        net_amount = amount * (1 - commission)
        
        if withdrawal_type == "instant":
            bank_fee = amount * BankingSystem.INSTANT_FEE
            net_amount -= bank_fee
        else:
            bank_fee = 0
        
        scheduled_for = datetime.now(timezone.utc)
        if withdrawal_type == "standard":
            scheduled_for += timedelta(hours=BankingSystem.STANDARD_QUEUE_HOURS)
        
        return {
            "id": str(uuid.uuid4()),
            "user_wallet": user_wallet,
            "amount": amount,
            "amount_ton": amount,  # For admin display
            "withdrawal_type": withdrawal_type,
            "platform_commission": round(amount * commission, 6),
            "bank_fee": round(bank_fee, 6),
            "net_amount": round(net_amount, 6),
            "status": "pending",
            "scheduled_for": scheduled_for.isoformat(),
            "bank_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    def can_process_instant(bank_business: dict, withdrawal_amount: float) -> Tuple[bool, str]:
        if not bank_business:
            return False, "no_bank_selected"
        config = BUSINESSES.get(bank_business.get("business_type"), {})
        if not config.get("instant_withdrawal"):
            return False, "not_a_bank"
        if bank_business.get("durability", 0) < 50:
            return False, "bank_durability_low"
        return True, "ok"
    
    @staticmethod
    def get_available_banks(banks_list: List[dict]) -> List[dict]:
        available = []
        for bank in banks_list:
            can_process, _ = BankingSystem.can_process_instant(bank, 0)
            if can_process:
                available.append({
                    "id": bank.get("id"),
                    "owner": bank.get("owner"),
                    "owner_username": bank.get("owner_username"),
                    "level": bank.get("level", 1),
                    "durability": bank.get("durability", 100),
                    "fee_rate": BankingSystem.INSTANT_FEE
                })
        return available


# ==================== EVENTS SYSTEM ====================

class EventsSystem:
    """Random events that affect the economy"""
    
    EVENTS = [
        {
            "id": "solar_flare",
            "name_ru": "Солнечная буря",
            "name_en": "Solar Flare",
            "effect": {"resource": "energy", "production_mult": 1.5, "duration_ticks": 3},
            "probability": 0.05,
        },
        {
            "id": "hack_attack",
            "name_ru": "Хакерская атака",
            "name_en": "Hack Attack",
            "effect": {"resource": "cu", "production_mult": 0.7, "duration_ticks": 2},
            "probability": 0.03,
        },
        {
            "id": "trade_boom",
            "name_ru": "Торговый бум",
            "name_en": "Trade Boom",
            "effect": {"resource": "traffic", "production_mult": 1.3, "duration_ticks": 4},
            "probability": 0.04,
        },
        {
            "id": "equipment_failure",
            "name_ru": "Поломка оборудования",
            "name_en": "Equipment Failure",
            "effect": {"all_durability_loss": 5},  # -5% durability to all
            "probability": 0.02,
        },
        {
            "id": "resource_discovery",
            "name_ru": "Открытие месторождения",
            "name_en": "Resource Discovery",
            "effect": {"resource": "quartz", "production_mult": 2.0, "duration_ticks": 2},
            "probability": 0.02,
        },
    ]
    
    @staticmethod
    def roll_events() -> List[dict]:
        """Roll for random events this tick"""
        triggered = []
        for event in EventsSystem.EVENTS:
            if random.random() < event["probability"]:
                triggered.append({
                    **event,
                    "triggered_at": datetime.now(timezone.utc).isoformat(),
                })
        return triggered


# ==================== ECONOMIC TICK ENGINE ====================

class EconomicTickEngine:
    """
    Master tick processor. Each tick executes in order:
    1. Production
    2. Resource purchasing (consumption)
    3. Maintenance deduction
    4. Profit calculation
    5. Income tax
    6. Turnover tax (on trades)
    7. NPC consumption
    8. Price updates
    9. Monopoly check
    10. Inflation
    11. Bankruptcy check
    12. Events
    13. Save snapshot
    """
    
    @staticmethod
    def process_tick_for_business(business: dict, available_resources: dict, 
                                  market_prices: dict, patron_bonus: float = 1.0,
                                  is_monopolist: bool = False,
                                  user_buff_multiplier: float = 1.0) -> dict:
        """
        Process one economic tick for a single business.
        Returns complete tick result with all calculations.
        `user_buff_multiplier` reflects active resource buffs (e.g. neuro_core +8%).
        """
        business_type = business.get("business_type")
        level = business.get("level", 1)
        durability = business.get("durability", 100)
        config = BUSINESSES.get(business_type, {})
        tier = config.get("tier", 1)
        
        result = {
            "business_id": business.get("id"),
            "business_type": business_type,
            "level": level,
            "tier": tier,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "steps": {},
        }
        
        # === STEP 1: PRODUCTION ===
        tick_output = BusinessEconomics.calculate_tick_output(business, patron_bonus, user_buff_multiplier)
        produced = tick_output["production"]
        produces_resource = tick_output["produces_resource"]
        result["steps"]["1_production"] = {
            "resource": produces_resource,
            "amount": produced,
            "durability_mult": tick_output.get("durability_mult", 1.0),
            "patron_bonus": patron_bonus,
            "user_buff_multiplier": user_buff_multiplier,
        }
        
        # === STEP 2: RESOURCE PURCHASING (Consumption) ===
        consumption = tick_output.get("consumption", {})
        can_operate = True
        consumed_resources = {}
        missing_resources = []
        
        for resource, required in consumption.items():
            available = available_resources.get(resource, 0)
            if available >= required:
                consumed_resources[resource] = required
            else:
                can_operate = False
                missing_resources.append({
                    "resource": resource,
                    "required": required,
                    "available": available,
                })
        
        if not can_operate:
            produced = 0  # Cannot produce without inputs
        
        result["steps"]["2_consumption"] = {
            "consumed": consumed_resources,
            "can_operate": can_operate,
            "missing": missing_resources,
        }
        
        # === STEP 3: MAINTENANCE ===
        maintenance_cost = TaxSystem.calculate_maintenance(business_type, level)
        result["steps"]["3_maintenance"] = {
            "daily_ton_cost": maintenance_cost,
        }
        
        # === STEP 4: PROFIT CALCULATION ===
        # For resource producers: profit = sell production on market
        # For TON producers (tier 3 + cyber_cafe): production IS profit
        if produces_resource in ("ton", "profit_ton"):
            gross_profit = produced * 0.01  # Internal units to TON conversion
        elif produces_resource and produces_resource in market_prices:
            gross_profit = produced * market_prices.get(produces_resource, 0.01)
        else:
            gross_profit = 0
        
        result["steps"]["4_profit"] = {
            "gross_profit_ton": round(gross_profit, 6),
            "produced_units": produced,
            "resource": produces_resource,
        }
        
        # === STEP 5: INCOME TAX ===
        has_patron = business.get("patron_id") is not None
        tax_split = TaxSystem.calculate_income_tax(gross_profit, tier, has_patron, is_monopolist)
        result["steps"]["5_income_tax"] = tax_split
        
        # === STEP 6: TURNOVER TAX (on the production sold) ===
        if produces_resource and produces_resource not in ("ton", "profit_ton"):
            turnover = TaxSystem.calculate_turnover_tax(gross_profit)
            result["steps"]["6_turnover_tax"] = turnover
            net_after_all_taxes = tax_split["player_income"] - turnover["tax"]
        else:
            result["steps"]["6_turnover_tax"] = {"tax": 0, "rate": 0}
            net_after_all_taxes = tax_split["player_income"]
        
        # Final player income after all deductions
        net_income = net_after_all_taxes - maintenance_cost
        
        result["net_income_ton"] = round(net_income, 6)
        result["treasury_income_ton"] = round(tax_split["treasury_tax"] + result["steps"]["6_turnover_tax"].get("tax", 0), 6)
        result["patron_income_ton"] = round(tax_split["patron_tax"], 6)
        result["maintenance_ton"] = maintenance_cost
        result["production_output"] = {
            "resource": produces_resource,
            "amount": round(produced, 2),
        }
        result["consumed_resources"] = consumed_resources
        result["can_operate"] = can_operate
        
        return result
    
    @staticmethod
    def process_global_tick(all_businesses: List[dict], market_data: dict) -> dict:
        """
        Process a full global economic tick.
        Steps 7-13 are global operations.
        """
        tick_result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "businesses_processed": len(all_businesses),
            "total_production": {},
            "total_consumption": {},
            "total_tax_collected": 0,
            "total_maintenance_collected": 0,
            "npc_interventions": [],
            "monopoly_warnings": [],
            "events": [],
            "bankruptcies": [],
        }
        
        # Step 7: NPC consumption
        total_supply = market_data.get("total_supply", {})
        npc_consumed = NPCMarketSystem.calculate_npc_consumption(total_supply)
        tick_result["npc_consumption"] = npc_consumed
        
        # Step 8: Price updates based on supply/demand
        current_prices = market_data.get("prices", {})
        for resource, price in current_prices.items():
            intervention = NPCMarketSystem.check_price_intervention(resource, price)
            if intervention:
                tick_result["npc_interventions"].append(intervention)
        
        # Step 9: Monopoly check is done per-player in process_tick_for_business
        
        # Step 10: Inflation
        total_ton_produced = sum(
            r.get("net_income_ton", 0) 
            for r in market_data.get("tick_results", [])
            if r.get("net_income_ton", 0) > 0
        )
        total_ton_sunk = sum(
            r.get("maintenance_ton", 0) + r.get("treasury_income_ton", 0)
            for r in market_data.get("tick_results", [])
        )
        
        inflation_factor = InflationSystem.calculate_inflation_factor(total_ton_produced, total_ton_sunk)
        new_prices = InflationSystem.apply_price_inflation(current_prices, inflation_factor)
        tick_result["inflation"] = {
            "factor": round(inflation_factor, 6),
            "ton_produced": round(total_ton_produced, 4),
            "ton_sunk": round(total_ton_sunk, 4),
        }
        tick_result["updated_prices"] = new_prices
        
        # Step 12: Events
        events = EventsSystem.roll_events()
        tick_result["events"] = events
        
        return tick_result


# ==================== INCOME COLLECTOR ====================

class IncomeCollector:
    """Handles periodic income collection from businesses using new tick engine"""
    
    @staticmethod
    def calculate_pending_income(business: dict, hours_passed: float = None, 
                                  patron_bonus: float = 1.0, market_prices: dict = None,
                                  user_buff_multiplier: float = 1.0) -> dict:
        """Calculate income accumulated since last collection.
        `user_buff_multiplier` applies global resource-buff bonus (e.g. neuro_core +8%)."""
        last_collection = business.get("last_collection")
        
        if hours_passed is None:
            if not last_collection:
                return {"pending": 0, "hours": 0}
            try:
                last_dt = datetime.fromisoformat(last_collection.replace('Z', '+00:00'))
                hours_passed = (datetime.now(timezone.utc) - last_dt).total_seconds() / 3600
            except (ValueError, TypeError):
                hours_passed = 0
        
        business_type = business.get("business_type")
        level = business.get("level", 1)
        durability = business.get("durability", 100)
        config = BUSINESSES.get(business_type, {})
        tier = config.get("tier", 1)
        
        if durability <= 0:
            return {"pending": 0, "hours": hours_passed, "halted": True}
        
        # Calculate per-tick production
        production = calculate_effective_production(business_type, level, durability, patron_bonus, user_buff_multiplier)
        produces = config.get("produces")
        
        if not market_prices:
            market_prices = {r: d.get("base_price", 0.01) for r, d in RESOURCE_TYPES.items()}
        
        # Convert production to TON value
        if produces in ("ton", "profit_ton"):
            hourly_value = production * 0.01 / 24.0  # Daily production converted to hourly
        elif produces and produces in market_prices:
            hourly_value = (production * market_prices.get(produces, 0.01)) / 24.0
        else:
            hourly_value = 0
        
        # Apply tax
        tax_rate = TIER_TAXES.get(tier, 0.15)
        net_hourly = hourly_value * (1 - tax_rate)
        
        # Deduct maintenance (hourly portion)
        maintenance_daily = MAINTENANCE_COSTS.get(tier, {}).get(level, 0.05)
        maintenance_hourly = maintenance_daily / 24.0
        
        net_hourly_after_maint = net_hourly - maintenance_hourly
        pending = net_hourly_after_maint * hours_passed
        
        return {
            "pending": round(max(0, pending), 6),
            "hours": round(hours_passed, 2),
            "halted": False,
            "gross_hourly": round(hourly_value, 6),
            "tax_rate": tax_rate,
            "net_hourly": round(net_hourly, 6),
            "maintenance_hourly": round(maintenance_hourly, 6),
        }
    
    @staticmethod
    def collect_income(business: dict, patron_wallet: Optional[str] = None,
                       market_prices: dict = None) -> dict:
        """Collect all pending income with tax distribution"""
        pending_data = IncomeCollector.calculate_pending_income(
            business, market_prices=market_prices
        )
        
        if pending_data.get("halted"):
            return {
                "collected": 0,
                "halted": True,
                "message": "Production halted - repair needed"
            }
        
        gross = pending_data["pending"]
        config = BUSINESSES.get(business.get("business_type"), {})
        tier = config.get("tier", 1)
        has_patron = patron_wallet is not None
        
        tax_split = TaxSystem.calculate_income_tax(gross, tier, has_patron)
        
        return {
            "collected": gross,
            "hours": pending_data["hours"],
            "player_receives": tax_split["player_income"],
            "treasury_receives": tax_split["treasury_tax"],
            "patron_receives": tax_split["patron_tax"],
            "patron_wallet": patron_wallet,
            "collected_at": datetime.now(timezone.utc).isoformat()
        }
