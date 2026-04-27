"""
Helper functions for the application
"""
import math
from tonsdk.utils import Address
from .config import ZONES_LEGACY, BUSINESS_TYPES, LEVEL_CONFIG, BASE_TAX_RATE, PROGRESSIVE_TAX
from business_config import BUSINESSES, BUSINESS_KEY_MAP


# ==================== BUSINESS CONFIG RESOLVER ====================

def resolve_business_config(business_type: str) -> dict:
    """Get BUSINESSES config for a business type, handling key mismatches
    (e.g. CITY_BUSINESSES uses `chip_factory`, BUSINESSES uses `chips_factory`)."""
    config = BUSINESSES.get(business_type)
    if config:
        return config
    mapped = BUSINESS_KEY_MAP.get(business_type, business_type)
    return BUSINESSES.get(mapped, {})


RESOURCE_NAMES = {
    "chips": "Чипы", "energy": "Энергия", "gadgets": "Гаджеты", "tokens": "Токены",
    "data": "Данные", "algorithms": "Алгоритмы", "ai_prompts": "AI-промпты",
    "nft": "NFT", "art": "Искусство", "stakes": "Стейкинг", "loans": "Займы",
    "logistics": "Логистика", "repair_kits": "Ремкомплект", "vr_experience": "VR-опыт",
    "profit_ton": "TON-прибыль",
    "neuro_core": "Нейро-ядро", "gold_bill": "Золотой вексель", "license_token": "Лицензия",
    "luck_chip": "Фишка удачи", "war_protocol": "Боевой протокол",
    "bio_module": "Био-модуль", "gateway_code": "Код шлюза",
}


def translate_resource_name(resource_code: str) -> str:
    return RESOURCE_NAMES.get(resource_code, resource_code)


# ==================== TON ADDRESS HELPERS ====================

def to_raw(address_str):
    """Convert TON address to raw format"""
    try:
        return Address(address_str).to_string(is_user_friendly=False)
    except Exception:
        return address_str


def to_user_friendly(raw_address):
    """Convert raw TON address to user-friendly format (UQ format for mainnet)"""
    try:
        return Address(raw_address).to_string(is_user_friendly=True, is_bounceable=True, is_testnet=False)
    except Exception:
        return raw_address


# ==================== OWNERSHIP HELPERS ====================

async def get_user_identifiers(db, current_user) -> dict:
    """Get all possible user identifiers for ownership checks"""
    user = None
    if current_user.wallet_address:
        user = await db.users.find_one({"wallet_address": current_user.wallet_address}, {"_id": 0})
    if not user and current_user.email:
        user = await db.users.find_one({"email": current_user.email}, {"_id": 0})
    if not user:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user:
        return {"user": None, "ids": set()}
    
    user_id = user.get("id", str(user.get("_id", "")))
    ids = {user_id, current_user.wallet_address, current_user.id}
    if user.get("wallet_address"):
        ids.add(user.get("wallet_address"))
    if user.get("email"):
        ids.add(user.get("email"))
    ids.discard(None)
    ids.discard("")
    return {"user": user, "ids": ids}


def is_owner(business: dict, user_ids: set) -> bool:
    """Check if business belongs to any of user's identifiers"""
    owner = business.get("owner", "")
    owner_wallet = business.get("owner_wallet", "")
    return owner in user_ids or owner_wallet in user_ids


def get_user_filter(user: dict) -> dict:
    """Get MongoDB filter to find user by best available identifier"""
    if user.get("email"):
        return {"email": user["email"]}
    if user.get("wallet_address"):
        return {"wallet_address": user["wallet_address"]}
    return {"id": user.get("id")}


def get_businesses_query(user_ids: set) -> dict:
    """Get MongoDB query to find businesses by any user identifier"""
    or_conditions = [{"owner": uid} for uid in user_ids]
    or_conditions.extend([{"owner_wallet": uid} for uid in user_ids])
    return {"$or": or_conditions}


# ==================== PRICE CALCULATION ====================

def calculate_plot_price(x: int, y: int) -> tuple:
    """Calculate plot price and zone based on distance from center"""
    center_x, center_y = 50, 50
    distance = math.sqrt((x - center_x)**2 + (y - center_y)**2)
    
    zone = "outskirts"
    for zone_name, config in ZONES_LEGACY.items():
        if distance <= config["radius_max"]:
            zone = zone_name
            break
    
    max_distance = math.sqrt(50**2 + 50**2)
    price = 10 + 90 * (1 - distance / max_distance)
    return round(price, 2), zone


def get_tax_rate(market_share: float) -> float:
    """Get progressive tax rate based on market share"""
    for threshold, rate in sorted(PROGRESSIVE_TAX.items(), reverse=True):
        if market_share >= threshold:
            return rate
    return BASE_TAX_RATE


def calculate_business_income(business_type: str, level: int, zone: str, connections: int) -> dict:
    """Calculate business income with all factors"""
    bt = BUSINESS_TYPES.get(business_type)
    if not bt:
        return {"gross": 0, "tax": 0, "net": 0}
    
    base = bt["base_income"]
    zone_mult = ZONES_LEGACY.get(zone, {}).get("price_mult", 0.5)
    level_mult = LEVEL_CONFIG.get(level, LEVEL_CONFIG[1])["income_mult"]
    conn_bonus = 1 + (connections * 0.05)
    
    gross = base * zone_mult * level_mult * conn_bonus
    tax = gross * BASE_TAX_RATE
    operating = bt.get("operating_cost", 0)
    net = gross - tax - operating
    
    return {
        "gross": round(gross, 4),
        "tax": round(tax, 4),
        "operating_cost": round(operating, 4),
        "net": round(max(0, net), 4)
    }


# ==================== TRANSLATION HELPER ====================

def t(key: str, lang: str = "en") -> str:
    """Simple translation helper"""
    translations = {
        "max_plots_reached": {"en": "Maximum plots reached for your level", "ru": "Достигнуто максимальное количество участков для вашего уровня"},
        "plot_not_available": {"en": "Plot not available", "ru": "Участок недоступен"},
        "invalid_zone": {"en": "Business not allowed in this zone", "ru": "Бизнес не разрешён в этой зоне"},
        "plot_purchased": {"en": "Plot purchased successfully", "ru": "Участок успешно приобретён"},
        "business_built": {"en": "Business built successfully", "ru": "Бизнес успешно построен"},
    }
    return translations.get(key, {}).get(lang, key)
