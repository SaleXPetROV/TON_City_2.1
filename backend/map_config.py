"""
TON City Map Configuration - Fixed Map with Pre-assigned Businesses
528 total plots:
- 478 plots with pre-assigned businesses
- 50 empty plots (for player choice, Tier 1 & 2 only)

Zone Distribution:
- Core (Ядро): 25 plots - Tier 3 businesses only
- Center (Центр): 56 plots - Tier 2 businesses
- Middle+Outer (Средняя+Внешняя): 397 plots - Tier 1 businesses + 50 empty
"""
import random
from typing import Dict, List, Tuple

# ==============================================
# BUSINESS DEFINITIONS WITH NEW ICONS & PRICES
# ==============================================

# Prices are for PLOT + BUSINESS combined (in TON, will be converted to $CITY)
# Monthly income as specified by user
CITY_BUSINESSES = {
    # ===== TIER 1: Basic Production (397 total, distributed in Middle+Outer) =====
    "helios": {
        "name": {"en": "Helios", "ru": "Helios"},
        "icon": "☀️",
        "tier": 1,
        "count": 57,
        "price_ton": 6.5,  # Price to buy plot+business
        "monthly_income_ton": 6.5,  # Income per month
        "daily_income_ton": 6.5 / 30,  # ~0.217 TON/day
        "description": {"en": "Solar power station", "ru": "Солнечная электростанция"},
    },
    "scrap_yard": {
        "name": {"en": "Scrap Yard", "ru": "Свалка"},
        "icon": "🏗️",
        "tier": 1,
        "count": 57,
        "price_ton": 6.9,
        "monthly_income_ton": 6.9,
        "daily_income_ton": 6.9 / 30,
        "description": {"en": "Scrap collection", "ru": "Сбор вторсырья"},
    },
    "quartz_mine": {
        "name": {"en": "Quartz Mine", "ru": "Шахта Кварца"},
        "icon": "💎",
        "tier": 1,
        "count": 57,
        "price_ton": 7.0,
        "monthly_income_ton": 7.0,
        "daily_income_ton": 7.0 / 30,
        "description": {"en": "Quartz crystal mining", "ru": "Добыча кварца"},
    },
    "nano_dc": {
        "name": {"en": "Nano DC", "ru": "Дата-центр"},
        "icon": "🖥️",
        "tier": 1,
        "count": 56,
        "price_ton": 6.8,
        "monthly_income_ton": 6.8,
        "daily_income_ton": 6.8 / 30,
        "description": {"en": "Data center", "ru": "Дата-центр"},
    },
    "signal_tower": {
        "name": {"en": "Signal Tower", "ru": "Вышка сигнала"},
        "icon": "📡",
        "tier": 1,
        "count": 56,
        "price_ton": 7.6,
        "monthly_income_ton": 7.6,
        "daily_income_ton": 7.6 / 30,
        "description": {"en": "Signal tower", "ru": "Вышка сигнала"},
    },
    "cold_storage": {
        "name": {"en": "Cold Storage", "ru": "Холодильник"},
        "icon": "❄️",
        "tier": 1,
        "count": 56,
        "price_ton": 6.9,
        "monthly_income_ton": 6.9,
        "daily_income_ton": 6.9 / 30,
        "description": {"en": "Cold storage facility", "ru": "Холодильная установка"},
    },
    "bio_farm": {
        "name": {"en": "Bio Farm", "ru": "Био-ферма"},
        "icon": "🌿",
        "tier": 1,
        "count": 58,
        "price_ton": 6.5,
        "monthly_income_ton": 6.5,
        "daily_income_ton": 6.5 / 30,
        "description": {"en": "Organic biomass farm", "ru": "Органическая ферма"},
    },
    
    # ===== TIER 2: Processing (56 total, distributed in Center) =====
    "chip_factory": {
        "name": {"en": "Chip Factory", "ru": "Завод микросхем"},
        "icon": "🏭",
        "tier": 2,
        "count": 8,
        "price_ton": 31.0,
        "monthly_income_ton": 31.0,
        "daily_income_ton": 31.0 / 30,
        "description": {"en": "Microchip factory", "ru": "Завод микросхем"},
    },
    "ai_lab": {
        "name": {"en": "AI Lab", "ru": "AI Лаборатория"},
        "icon": "🧪",
        "tier": 2,
        "count": 8,
        "price_ton": 36.8,
        "monthly_income_ton": 36.8,
        "daily_income_ton": 36.8 / 30,
        "description": {"en": "AI research laboratory", "ru": "Лаборатория ИИ"},
    },
    "nft_studio": {
        "name": {"en": "NFT Studio", "ru": "NFT Студия"},
        "icon": "🎨",
        "tier": 2,
        "count": 8,
        "price_ton": 36.0,
        "monthly_income_ton": 36.0,
        "daily_income_ton": 36.0 / 30,
        "description": {"en": "NFT art studio", "ru": "Студия NFT"},
    },
    "vr_club": {
        "name": {"en": "VR Club", "ru": "VR Клуб"},
        "icon": "👓",
        "tier": 2,
        "count": 8,
        "price_ton": 32.5,
        "monthly_income_ton": 32.5,
        "daily_income_ton": 32.5 / 30,
        "description": {"en": "Virtual reality club", "ru": "Клуб виртуальной реальности"},
    },
    "logistics": {
        "name": {"en": "Logistics", "ru": "Логистика"},
        "icon": "🚁",
        "tier": 2,
        "count": 8,
        "price_ton": 41.7,
        "monthly_income_ton": 41.7,
        "daily_income_ton": 41.7 / 30,
        "description": {"en": "Logistics hub", "ru": "Логистический хаб"},
    },
    "cyber_cafe": {
        "name": {"en": "Cyber Cafe", "ru": "Кибер-кафе"},
        "icon": "☕",
        "tier": 2,
        "count": 8,
        "price_ton": 35.2,
        "monthly_income_ton": 35.2,
        "daily_income_ton": 35.2 / 30,
        "description": {"en": "Cyber cafe", "ru": "Кибер-кафе"},
    },
    "repair_zone": {
        "name": {"en": "Repair Zone", "ru": "Ремонтная зона"},
        "icon": "🛠️",
        "tier": 2,
        "count": 8,
        "price_ton": 36.8,
        "monthly_income_ton": 36.8,
        "daily_income_ton": 36.8 / 30,
        "description": {"en": "Repair workshop", "ru": "Ремонтная мастерская"},
    },
    
    # ===== TIER 3: Infrastructure (25 total, distributed in Core) =====
    "validator": {
        "name": {"en": "Validator", "ru": "Валидатор"},
        "icon": "🛡️",
        "tier": 3,
        "count": 4,
        "price_ton": 286.0,
        "monthly_income_ton": 286.0,
        "daily_income_ton": 286.0 / 30,
        "description": {"en": "Blockchain validator", "ru": "Валидатор блокчейна"},
        "is_patron": True,
    },
    "gram_bank": {
        "name": {"en": "Gram Bank", "ru": "Банк Gram"},
        "icon": "🏦",
        "tier": 3,
        "count": 3,
        "price_ton": 278.4,
        "monthly_income_ton": 278.4,
        "daily_income_ton": 278.4 / 30,
        "description": {"en": "Banking services", "ru": "Банковские услуги"},
        "is_patron": True,
    },
    "dex": {
        "name": {"en": "DEX", "ru": "DEX Биржа"},
        "icon": "💹",
        "tier": 3,
        "count": 4,
        "price_ton": 290.0,
        "monthly_income_ton": 290.0,
        "daily_income_ton": 290.0 / 30,
        "description": {"en": "Decentralized exchange", "ru": "Децентрализованная биржа"},
        "is_patron": True,
    },
    "casino": {
        "name": {"en": "Casino", "ru": "Казино"},
        "icon": "🎰",
        "tier": 3,
        "count": 4,
        "price_ton": 288.0,
        "monthly_income_ton": 288.0,
        "daily_income_ton": 288.0 / 30,
        "description": {"en": "Crypto casino", "ru": "Крипто-казино"},
        "is_patron": True,
    },
    "arena": {
        "name": {"en": "Arena", "ru": "Арена"},
        "icon": "🏟️",
        "tier": 3,
        "count": 4,
        "price_ton": 294.5,  # Most expensive - will be in center
        "monthly_income_ton": 294.5,
        "daily_income_ton": 294.5 / 30,
        "description": {"en": "Battle arena", "ru": "Боевая арена"},
        "is_patron": True,
    },
    "incubator": {
        "name": {"en": "Incubator", "ru": "Инкубатор"},
        "icon": "🐣",
        "tier": 3,
        "count": 3,
        "price_ton": 280.0,
        "monthly_income_ton": 280.0,
        "daily_income_ton": 280.0 / 30,
        "description": {"en": "Startup incubator", "ru": "Инкубатор стартапов"},
        "is_patron": True,
    },
    "bridge": {
        "name": {"en": "Bridge", "ru": "Мост"},
        "icon": "🌉",
        "tier": 3,
        "count": 3,
        "price_ton": 265.7,
        "monthly_income_ton": 265.7,
        "daily_income_ton": 265.7 / 30,
        "description": {"en": "Cross-chain bridge", "ru": "Кросс-чейн мост"},
        "is_patron": True,
    },
}

# ==============================================
# $CITY CURRENCY CONFIGURATION
# ==============================================
CITY_CURRENCY = {
    "name": "$CITY",
    "symbol": "$CITY",
    "ton_rate": 1000,  # 1 TON = 1000 $CITY
}

def ton_to_city(ton_amount: float) -> float:
    """Convert TON to $CITY"""
    return ton_amount * CITY_CURRENCY["ton_rate"]

def city_to_ton(city_amount: float) -> float:
    """Convert $CITY to TON"""
    return city_amount / CITY_CURRENCY["ton_rate"]

# ==============================================
# ZONE CONFIGURATION
# ==============================================
# Zone radii (Manhattan distance from center)
ZONE_CONFIG = {
    "core": {
        "max_distance": 3,  # 0-3 from center
        "allowed_tiers": [3],
        "color": "#7dd3fc",
        "name": {"en": "Core", "ru": "Ядро"},
    },
    "center": {
        "max_distance": 7,  # 4-7 from center
        "allowed_tiers": [2],
        "color": "#60a5fa",
        "name": {"en": "Center", "ru": "Центр"},
    },
    "middle": {
        "max_distance": 12,  # 8-12 from center
        "allowed_tiers": [1],
        "color": "#3b82f6",
        "name": {"en": "Middle", "ru": "Средняя"},
    },
    "outer": {
        "max_distance": 999,  # 13+ from center
        "allowed_tiers": [1],
        "color": "#2563eb",
        "name": {"en": "Outer", "ru": "Внешняя"},
    },
}

# Empty plots configuration (50 plots, NOT in core)
EMPTY_PLOTS_COUNT = 50
EMPTY_PLOT_ALLOWED_ZONES = ["center", "middle", "outer"]
EMPTY_PLOT_BUILDABLE_TIERS = [1, 2]  # Only Tier 1 and 2 can be built on empty plots


def get_zone_by_distance(distance: int) -> str:
    """Get zone name by Manhattan distance from center"""
    for zone_name, config in ZONE_CONFIG.items():
        if distance <= config["max_distance"]:
            return zone_name
    return "outer"


def generate_fixed_map(width: int = 35, height: int = 35, target_plots: int = 528) -> Dict:
    """
    Generate a fixed map with 528 plots and pre-assigned businesses.
    
    Returns a dictionary with:
    - cells: List of all cells with their coordinates, zone, and assigned business
    - stats: Statistics about the map
    """
    random.seed(42)  # Fixed seed for reproducibility
    
    center_x, center_y = width // 2, height // 2
    
    # Generate island shape - more plots needed
    cells = []
    
    # Create cells in expanding rings from center
    for y in range(height):
        for x in range(width):
            # Manhattan distance from center
            dist = abs(x - center_x) + abs(y - center_y)
            
            # Include more cells to reach 528
            max_dist = max(center_x, center_y)
            threshold = 0.85 + (random.random() * 0.15)  # More inclusive
            
            if dist / max_dist < threshold:
                    zone = get_zone_by_distance(dist)
                    cells.append({
                        "x": x,
                        "y": y,
                        "q": x,  # Hex coordinates (same as x,y for square grid)
                        "r": y,
                        "distance": dist,
                        "zone": zone,
                        "business": None,
                        "is_empty": False,
                    })
    
    # Trim to target number of plots (528)
    if len(cells) > target_plots:
        # Sort by distance (keep center plots, remove outer ones)
        cells.sort(key=lambda c: c["distance"])
        cells = cells[:target_plots]
    
    # Sort cells by zone for business assignment
    core_cells = [c for c in cells if c["zone"] == "core"]
    center_cells = [c for c in cells if c["zone"] == "center"]
    middle_outer_cells = [c for c in cells if c["zone"] in ["middle", "outer"]]
    
    # Shuffle for random distribution within zones
    random.shuffle(core_cells)
    random.shuffle(center_cells)
    random.shuffle(middle_outer_cells)
    
    # === ASSIGN TIER 3 BUSINESSES TO CORE (25 plots) ===
    tier3_businesses = [b for b_id, b in CITY_BUSINESSES.items() if b["tier"] == 3]
    tier3_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] == 3:
            tier3_pool.extend([b_id] * b["count"])
    
    # Put Arena (most expensive) in the very center
    center_cell = min(core_cells, key=lambda c: c["distance"])
    center_cell["business"] = "arena"
    center_cell["is_center"] = True
    tier3_pool.remove("arena")  # Remove one arena from pool
    
    # Assign rest of Tier 3 to core
    random.shuffle(tier3_pool)
    core_idx = 0
    for cell in core_cells:
        if cell.get("is_center"):
            continue
        if core_idx < len(tier3_pool):
            cell["business"] = tier3_pool[core_idx]
            core_idx += 1
    
    # === ASSIGN TIER 2 BUSINESSES TO CENTER (56 plots) ===
    tier2_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] == 2:
            tier2_pool.extend([b_id] * b["count"])
    
    random.shuffle(tier2_pool)
    center_idx = 0
    for cell in center_cells:
        if center_idx < len(tier2_pool):
            cell["business"] = tier2_pool[center_idx]
            center_idx += 1
    
    # === ASSIGN TIER 1 BUSINESSES TO MIDDLE/OUTER + EMPTY PLOTS ===
    tier1_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] == 1:
            tier1_pool.extend([b_id] * b["count"])
    
    # Reserve 50 empty plots (randomly distributed in middle/outer)
    empty_indices = random.sample(range(len(middle_outer_cells)), min(EMPTY_PLOTS_COUNT, len(middle_outer_cells)))
    
    random.shuffle(tier1_pool)
    tier1_idx = 0
    for i, cell in enumerate(middle_outer_cells):
        if i in empty_indices:
            cell["is_empty"] = True
            cell["business"] = None
        elif tier1_idx < len(tier1_pool):
            cell["business"] = tier1_pool[tier1_idx]
            tier1_idx += 1
    
    # Combine all cells
    all_cells = core_cells + center_cells + middle_outer_cells
    
    # Calculate stats
    stats = {
        "total_plots": len(all_cells),
        "core_plots": len(core_cells),
        "center_plots": len(center_cells),
        "middle_outer_plots": len(middle_outer_cells),
        "empty_plots": sum(1 for c in all_cells if c["is_empty"]),
        "tier1_businesses": sum(1 for c in all_cells if c["business"] and CITY_BUSINESSES.get(c["business"], {}).get("tier") == 1),
        "tier2_businesses": sum(1 for c in all_cells if c["business"] and CITY_BUSINESSES.get(c["business"], {}).get("tier") == 2),
        "tier3_businesses": sum(1 for c in all_cells if c["business"] and CITY_BUSINESSES.get(c["business"], {}).get("tier") == 3),
    }
    
    return {
        "cells": all_cells,
        "stats": stats,
        "width": width,
        "height": height,
        "center": {"x": center_x, "y": center_y},
    }


def get_plot_price(business_id: str) -> Dict:
    """Get the price for a plot with business in both TON and $CITY"""
    if not business_id or business_id not in CITY_BUSINESSES:
        # Empty plot base price
        base_price_ton = 5.0
        return {
            "ton": base_price_ton,
            "city": ton_to_city(base_price_ton),
        }
    
    business = CITY_BUSINESSES[business_id]
    return {
        "ton": business["price_ton"],
        "city": ton_to_city(business["price_ton"]),
    }


def get_buildable_businesses() -> List[Dict]:
    """Get list of businesses that can be built on empty plots (Tier 1 & 2 only)"""
    result = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] in EMPTY_PLOT_BUILDABLE_TIERS:
            result.append({
                "id": b_id,
                "name": b["name"],
                "icon": b["icon"],
                "tier": b["tier"],
                "price_ton": b["price_ton"],
                "price_city": ton_to_city(b["price_ton"]),
                "monthly_income_ton": b["monthly_income_ton"],
                "monthly_income_city": ton_to_city(b["monthly_income_ton"]),
            })
    return result


# For testing
if __name__ == "__main__":
    map_data = generate_fixed_map()
    print(f"Generated map with {map_data['stats']['total_plots']} plots")
    print(f"Stats: {map_data['stats']}")
    
    # Verify counts
    tier1_count = sum(b["count"] for b in CITY_BUSINESSES.values() if b["tier"] == 1)
    tier2_count = sum(b["count"] for b in CITY_BUSINESSES.values() if b["tier"] == 2)
    tier3_count = sum(b["count"] for b in CITY_BUSINESSES.values() if b["tier"] == 3)
    print(f"Expected: Tier1={tier1_count}, Tier2={tier2_count}, Tier3={tier3_count}, Empty=50")
    print(f"Total expected: {tier1_count + tier2_count + tier3_count + 50}")
