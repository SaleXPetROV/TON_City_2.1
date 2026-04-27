"""
Game constants and configuration
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'ton-city-builder-secret-key-2025')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'admin-secret-key-2025')
ADMIN_WALLET = os.environ.get('ADMIN_WALLET_ADDRESS') or os.environ.get('ADMIN_WALLET') or None
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Game Constants
RESALE_COMMISSION = 0.15  # 15% tax on resale to prevent speculation
DEMOLISH_COST = 0.05  # 5% of business cost to demolish
TRADE_COMMISSION = 0.0  # No trade commission - income tax applies when user receives money
RENTAL_COMMISSION = 0.10
WITHDRAWAL_COMMISSION = 0.03
MIN_WITHDRAWAL = 1.0
BASE_TAX_RATE = 0.10

PROGRESSIVE_TAX = {
    0.05: 0.12,
    0.10: 0.15,
    0.15: 0.18,
    0.20: 0.22,
    0.25: 0.25,
}

# Level system multipliers
LEVEL_CONFIG = {
    1: {"xp_required": 0, "income_mult": 1.0, "speed_mult": 1.0, "bonus": None, "upgrade_cost": 0},
    2: {"xp_required": 100, "income_mult": 1.2, "speed_mult": 1.1, "bonus": "upgrades", "upgrade_cost": 5},
    3: {"xp_required": 300, "income_mult": 1.5, "speed_mult": 1.2, "bonus": "discount_5", "upgrade_cost": 10},
    4: {"xp_required": 600, "income_mult": 1.8, "speed_mult": 1.3, "bonus": "storage", "upgrade_cost": 20},
    5: {"xp_required": 1000, "income_mult": 2.2, "speed_mult": 1.5, "bonus": "automation_1", "upgrade_cost": 35},
    6: {"xp_required": 1500, "income_mult": 2.7, "speed_mult": 1.7, "bonus": "discount_10", "upgrade_cost": 50},
    7: {"xp_required": 2200, "income_mult": 3.3, "speed_mult": 2.0, "bonus": "automation_2", "upgrade_cost": 75},
    8: {"xp_required": 3000, "income_mult": 4.0, "speed_mult": 2.3, "bonus": "vip", "upgrade_cost": 100},
    9: {"xp_required": 4000, "income_mult": 5.0, "speed_mult": 2.7, "bonus": "franchise", "upgrade_cost": 150},
    10: {"xp_required": 5500, "income_mult": 6.5, "speed_mult": 3.0, "bonus": "corporation", "upgrade_cost": 200},
}

# Player levels
PLAYER_LEVELS = {
    "novice": {"min_turnover": 0, "max_plots": 3, "max_market_share": 0.05},
    "entrepreneur": {"min_turnover": 100, "max_plots": 7, "max_market_share": 0.10},
    "businessman": {"min_turnover": 500, "max_plots": 15, "max_market_share": 0.15},
    "magnate": {"min_turnover": 2000, "max_plots": 30, "max_market_share": 0.20},
    "oligarch": {"min_turnover": 10000, "max_plots": 50, "max_market_share": 0.25},
    1: {"min_turnover": 0, "max_plots": 3, "max_market_share": 0.05},
    2: {"min_turnover": 50, "max_plots": 5, "max_market_share": 0.07},
    3: {"min_turnover": 100, "max_plots": 7, "max_market_share": 0.10},
    4: {"min_turnover": 250, "max_plots": 10, "max_market_share": 0.12},
    5: {"min_turnover": 500, "max_plots": 15, "max_market_share": 0.15},
}

# Zone configuration
ZONES = {
    "center": {"radius_max": 10, "plot_limit": 3, "price_mult": 1.0},
    "business": {"radius_max": 25, "plot_limit": 10, "price_mult": 0.7},
    "residential": {"radius_max": 40, "plot_limit": 15, "price_mult": 0.45},
    "industrial": {"radius_max": 50, "plot_limit": 20, "price_mult": 0.25},
    "outskirts": {"radius_max": 100, "plot_limit": 30, "price_mult": 0.12},
}

# Business types with full configuration
BUSINESS_TYPES = {
    "farm": {
        "name": {"en": "Farm", "ru": "Ферма", "zh": "农场"},
        "icon": "🌾",
        "sector": "primary",
        "cost": 5,
        "build_time_hours": 2,
        "materials_required": 50,
        "energy_consumption": 10,
        "produces": "crops",
        "production_rate": 100,
        "requires": None,
        "base_income": 2.4,
        "operating_cost": 0.3,
        "allowed_zones": ["residential", "industrial", "outskirts"],
        "max_per_player": 10,
        "min_builders": 1,
    },
    "power_plant": {
        "name": {"en": "Power Plant", "ru": "Электростанция", "zh": "发电厂"},
        "icon": "⚡",
        "sector": "primary",
        "cost": 20,
        "build_time_hours": 8,
        "materials_required": 300,
        "energy_consumption": 0,
        "produces": "energy",
        "production_rate": 500,
        "requires": None,
        "base_income": 2.4,
        "operating_cost": 0.8,
        "allowed_zones": ["industrial", "outskirts"],
        "max_per_player": 3,
        "min_builders": 2,
    },
    "quarry": {
        "name": {"en": "Quarry", "ru": "Карьер", "zh": "采石场"},
        "icon": "⛏️",
        "sector": "primary",
        "cost": 25,
        "build_time_hours": 10,
        "materials_required": 200,
        "energy_consumption": 80,
        "produces": "materials",
        "production_rate": 50,
        "requires": None,
        "base_income": 6.0,
        "operating_cost": 1.5,
        "allowed_zones": ["industrial", "outskirts"],
        "max_per_player": 5,
        "min_builders": 2,
    },
    "factory": {
        "name": {"en": "Factory", "ru": "Завод", "zh": "工厂"},
        "icon": "🏭",
        "sector": "secondary",
        "cost": 15,
        "build_time_hours": 6,
        "materials_required": 150,
        "energy_consumption": 50,
        "produces": "goods",
        "production_rate": 30,
        "requires": "crops",
        "consumption_rate": 50,
        "base_income": 2.88,
        "operating_cost": 1.44,
        "allowed_zones": ["business", "industrial"],
        "max_per_player": 8,
        "min_builders": 2,
    },
    "shop": {
        "name": {"en": "Shop", "ru": "Магазин", "zh": "商店"},
        "icon": "🏪",
        "sector": "tertiary",
        "cost": 10,
        "build_time_hours": 4,
        "materials_required": 100,
        "energy_consumption": 20,
        "produces": "retail",
        "production_rate": 0,
        "requires": "goods",
        "consumption_rate": 30,
        "base_income": 4.8,
        "operating_cost": 0.5,
        "allowed_zones": ["center", "business", "residential"],
        "max_per_player": 15,
        "min_builders": 1,
        "customer_flow": {"center": 100, "business": 60, "residential": 40},
    },
    "restaurant": {
        "name": {"en": "Restaurant", "ru": "Ресторан", "zh": "餐厅"},
        "icon": "🍽️",
        "sector": "tertiary",
        "cost": 12,
        "build_time_hours": 5,
        "materials_required": 120,
        "energy_consumption": 30,
        "produces": "food_service",
        "production_rate": 30,
        "requires": "crops",
        "consumption_rate": 30,
        "base_income": 5.4,
        "operating_cost": 0.86,
        "allowed_zones": ["center", "business", "residential"],
        "max_per_player": 10,
        "min_builders": 1,
    },
    "bank": {
        "name": {"en": "Bank", "ru": "Банк", "zh": "银行"},
        "icon": "🏦",
        "sector": "quaternary",
        "cost": 50,
        "build_time_hours": 24,
        "materials_required": 500,
        "energy_consumption": 40,
        "produces": "finance",
        "production_rate": 0,
        "requires": None,
        "base_income": 4.5,
        "operating_cost": 0.6,
        "allowed_zones": ["center", "business"],
        "max_per_player": 1,
        "min_builders": 3,
    },
}

# Resource prices (base)
RESOURCE_PRICES = {
    "crops": 0.01,
    "energy": 0.01,
    "materials": 0.01,
    "fuel": 0.01,
    "ore": 0.01,
    "goods": 0.01,
    "refined_fuel": 0.015,
    "steel": 0.012,
    "textiles": 0.01,
    "cu": 0.02,
    "quartz": 0.015,
    "traffic": 0.012,
    "cooling": 0.02,
    "biomass": 0.018,
    "scrap": 0.01,
    "chips": 0.10,
    "nft": 0.15,
    "neurocode": 0.20,
    "logistics": 0.05,
    "repair_kits": 0.08,
    "vr_experience": 0.12,
    "shares": 0.50,
}
