"""
Business Financial Model - TON City

Tier 1 (Мелкие бизнесы): farm, solar_panel, wind_turbine, warehouse
Tier 2 (Средние бизнесы): data_center, factory, repair_shop, restaurant  
Tier 3 (Крупные бизнесы): crypto_mine, ai_lab, shopping_mall, skyscraper

Каждый бизнес имеет 10 уровней
"""

# Базовые требования ресурсов для работы бизнеса (в единицах/час)
BASE_REQUIREMENTS = {
    # Tier 1 - Мелкие
    "farm": {"electricity": 1, "cooling": 0},
    "solar_panel": {"electricity": 0, "cooling": 0.5},
    "wind_turbine": {"electricity": 0, "cooling": 0},
    "warehouse": {"electricity": 2, "cooling": 1},
    
    # Tier 2 - Средние
    "data_center": {"electricity": 10, "cooling": 8},
    "factory": {"electricity": 15, "cooling": 5},
    "repair_shop": {"electricity": 5, "cooling": 2},
    "restaurant": {"electricity": 8, "cooling": 6},
    
    # Tier 3 - Крупные
    "crypto_mine": {"electricity": 30, "cooling": 25},
    "ai_lab": {"electricity": 50, "cooling": 40},
    "shopping_mall": {"electricity": 25, "cooling": 15},
    "skyscraper": {"electricity": 40, "cooling": 20}
}

# Базовое производство ресурсов (единиц/час)
BASE_PRODUCTION = {
    # Tier 1
    "farm": {"food": 10, "scrap": 0},
    "solar_panel": {"electricity": 15, "data": 0},
    "wind_turbine": {"electricity": 12, "cooling": 0},
    "warehouse": {"storage_bonus": 50, "logistics": 5},
    
    # Tier 2  
    "data_center": {"compute": 20, "data": 15},
    "factory": {"scrap": 25, "parts": 10},
    "repair_shop": {"parts": 8, "service": 12},
    "restaurant": {"food_processed": 15, "entertainment": 5},
    
    # Tier 3
    "crypto_mine": {"ton_per_day": 0.1, "compute": 30},
    "ai_lab": {"data": 50, "compute": 40},
    "shopping_mall": {"ton_per_day": 0.05, "entertainment": 30},
    "skyscraper": {"rent_ton_per_day": 0.08, "prestige": 50}
}

# Множитель для каждого уровня (1-10)
LEVEL_MULTIPLIERS = {
    1: 1.0,
    2: 1.2,
    3: 1.45,
    4: 1.7,
    5: 2.0,
    6: 2.3,
    7: 2.6,
    8: 2.9,
    9: 3.2,
    10: 3.5
}

# Стоимость улучшения до следующего уровня (в TON)
UPGRADE_COSTS = {
    # Tier 1 - Дешёвые улучшения
    "tier1": {
        1: {"ton": 0.5, "resources": {"scrap": 10}},
        2: {"ton": 1.0, "resources": {"scrap": 25, "electricity": 10}},
        3: {"ton": 2.0, "resources": {"scrap": 50, "electricity": 25}},
        4: {"ton": 4.0, "resources": {"scrap": 100, "electricity": 50, "parts": 10}},
        5: {"ton": 8.0, "resources": {"scrap": 200, "electricity": 100, "parts": 25}},
        6: {"ton": 15.0, "resources": {"scrap": 400, "parts": 50, "compute": 10}},
        7: {"ton": 25.0, "resources": {"scrap": 600, "parts": 100, "compute": 25}},
        8: {"ton": 40.0, "resources": {"scrap": 1000, "parts": 200, "compute": 50}},
        9: {"ton": 60.0, "resources": {"scrap": 1500, "parts": 350, "compute": 100, "data": 25}},
        10: None  # Max level
    },
    # Tier 2 - Средние улучшения
    "tier2": {
        1: {"ton": 2.0, "resources": {"scrap": 50, "parts": 10}},
        2: {"ton": 4.0, "resources": {"scrap": 100, "parts": 25, "compute": 5}},
        3: {"ton": 8.0, "resources": {"scrap": 200, "parts": 50, "compute": 15}},
        4: {"ton": 15.0, "resources": {"scrap": 400, "parts": 100, "compute": 30, "data": 10}},
        5: {"ton": 30.0, "resources": {"scrap": 800, "parts": 200, "compute": 60, "data": 25}},
        6: {"ton": 50.0, "resources": {"parts": 400, "compute": 120, "data": 50}},
        7: {"ton": 80.0, "resources": {"parts": 600, "compute": 200, "data": 100, "quartz": 10}},
        8: {"ton": 120.0, "resources": {"parts": 1000, "compute": 350, "data": 200, "quartz": 25}},
        9: {"ton": 180.0, "resources": {"parts": 1500, "compute": 500, "data": 350, "quartz": 50}},
        10: None
    },
    # Tier 3 - Дорогие улучшения
    "tier3": {
        1: {"ton": 10.0, "resources": {"parts": 100, "compute": 50, "data": 25}},
        2: {"ton": 20.0, "resources": {"parts": 200, "compute": 100, "data": 50, "quartz": 5}},
        3: {"ton": 40.0, "resources": {"parts": 400, "compute": 200, "data": 100, "quartz": 15}},
        4: {"ton": 80.0, "resources": {"parts": 800, "compute": 400, "data": 200, "quartz": 30}},
        5: {"ton": 150.0, "resources": {"compute": 800, "data": 400, "quartz": 60}},
        6: {"ton": 250.0, "resources": {"compute": 1200, "data": 600, "quartz": 100}},
        7: {"ton": 400.0, "resources": {"compute": 2000, "data": 1000, "quartz": 150}},
        8: {"ton": 600.0, "resources": {"compute": 3000, "data": 1500, "quartz": 250}},
        9: {"ton": 900.0, "resources": {"compute": 5000, "data": 2500, "quartz": 400}},
        10: None
    }
}

# Тир бизнеса
BUSINESS_TIERS = {
    "farm": 1,
    "solar_panel": 1,
    "wind_turbine": 1,
    "warehouse": 1,
    "data_center": 2,
    "factory": 2,
    "repair_shop": 2,
    "restaurant": 2,
    "crypto_mine": 3,
    "ai_lab": 3,
    "shopping_mall": 3,
    "skyscraper": 3
}

BUSINESS_NAMES_RU = {
    "farm": "Ферма",
    "solar_panel": "Солнечная панель",
    "wind_turbine": "Ветряная турбина",
    "warehouse": "Склад",
    "data_center": "Дата-центр",
    "factory": "Завод",
    "repair_shop": "Ремонтная мастерская",
    "restaurant": "Ресторан",
    "crypto_mine": "Крипто-ферма",
    "ai_lab": "AI Лаборатория",
    "shopping_mall": "Торговый центр",
    "skyscraper": "Небоскрёб"
}

TIER_NAMES = {
    1: "Мелкий бизнес",
    2: "Средний бизнес", 
    3: "Крупный бизнес"
}


def get_production_at_level(business_type: str, level: int) -> dict:
    """Расчёт производства на конкретном уровне"""
    base_production = BASE_PRODUCTION.get(business_type)
    if not base_production:
        return None
    
    multiplier = LEVEL_MULTIPLIERS.get(level, 1)
    production = {}
    
    for resource, amount in base_production.items():
        production[resource] = round(amount * multiplier, 2)
    
    return production


def get_requirements_at_level(business_type: str, level: int) -> dict:
    """Расчёт требований на конкретном уровне"""
    base_req = BASE_REQUIREMENTS.get(business_type)
    if not base_req:
        return None
    
    multiplier = LEVEL_MULTIPLIERS.get(level, 1)
    requirements = {}
    
    for resource, amount in base_req.items():
        requirements[resource] = round(amount * multiplier, 2)
    
    return requirements


def get_upgrade_cost(business_type: str, current_level: int) -> dict:
    """Получение стоимости улучшения"""
    tier = BUSINESS_TIERS.get(business_type, 1)
    tier_key = f"tier{tier}"
    costs = UPGRADE_COSTS.get(tier_key)
    
    if not costs or not costs.get(current_level):
        return None
    
    return costs[current_level]


def get_business_tier(business_type: str) -> int:
    """Получение тира бизнеса"""
    return BUSINESS_TIERS.get(business_type, 1)


def get_tax_rate_for_business(business_type: str, tax_settings: dict) -> float:
    """Получение налоговой ставки для бизнеса"""
    tier = get_business_tier(business_type)
    
    if tier == 1:
        return tax_settings.get("small_business_tax", 5) / 100
    elif tier == 2:
        return tax_settings.get("medium_business_tax", 8) / 100
    else:  # tier 3
        return tax_settings.get("large_business_tax", 10) / 100


def get_all_levels_info(business_type: str) -> list:
    """Получить информацию о всех уровнях бизнеса"""
    tier = get_business_tier(business_type)
    result = []
    
    for level in range(1, 11):
        production = get_production_at_level(business_type, level)
        requirements = get_requirements_at_level(business_type, level)
        upgrade_cost = get_upgrade_cost(business_type, level)
        
        result.append({
            "level": level,
            "production": production,
            "requirements": requirements,
            "upgrade_cost": upgrade_cost,
            "multiplier": LEVEL_MULTIPLIERS.get(level, 1)
        })
    
    return result
