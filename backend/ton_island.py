"""
TON Island Map Generator v2.0
Creates a diamond-shaped island with exactly 528 playable cells
and pre-assigned businesses according to tier zones.

Zone Distribution:
- Core (Ядро): 25 cells - Tier 3 businesses only
- Center (Центр): 56 cells - Tier 2 businesses  
- Middle+Outer (Средняя+Внешняя): 447 cells - Tier 1 businesses (397) + 50 empty
"""
import math
import random
from typing import List, Dict, Tuple

# ==============================================
# $CITY CURRENCY
# ==============================================
CITY_RATE = 1000  # 1 TON = 1000 $CITY

def ton_to_city(ton: float) -> float:
    return ton * CITY_RATE

def city_to_ton(city: float) -> float:
    return city / CITY_RATE

# ==============================================
# BUSINESS CONFIGURATION (21 types)
# ==============================================
# Prices are for LAND + BUSINESS combined (in TON)

CITY_BUSINESSES = {
    # ===== TIER 1: Basic Production (397 total) =====
    "helios": {
        "name": {"en": "Helios", "ru": "Helios"},
        "icon": "☀️",
        "tier": 1,
        "count": 57,
        "price_ton": 6.5,
        "monthly_income_ton": 6.5,
    },
    "scrap_yard": {
        "name": {"en": "Scrap Yard", "ru": "Свалка"},
        "icon": "🏗️",
        "tier": 1,
        "count": 57,
        "price_ton": 6.9,
        "monthly_income_ton": 6.9,
    },
    "quartz_mine": {
        "name": {"en": "Quartz Mine", "ru": "Кварцевая шахта"},
        "icon": "💎",
        "tier": 1,
        "count": 57,
        "price_ton": 7.0,
        "monthly_income_ton": 7.0,
    },
    "nano_dc": {
        "name": {"en": "Nano DC", "ru": "Дата-центр"},
        "icon": "🖥️",
        "tier": 1,
        "count": 56,
        "price_ton": 6.8,
        "monthly_income_ton": 6.8,
    },
    "signal_tower": {
        "name": {"en": "Signal Tower", "ru": "Вышка сигнала"},
        "icon": "📡",
        "tier": 1,
        "count": 56,
        "price_ton": 7.6,
        "monthly_income_ton": 7.6,
    },
    "cold_storage": {
        "name": {"en": "Cold Storage", "ru": "Холодильник"},
        "icon": "❄️",
        "tier": 1,
        "count": 56,
        "price_ton": 6.9,
        "monthly_income_ton": 6.9,
    },
    "bio_farm": {
        "name": {"en": "Bio Farm", "ru": "Био-ферма"},
        "icon": "🌿",
        "tier": 1,
        "count": 58,
        "price_ton": 6.5,
        "monthly_income_ton": 6.5,
    },
    
    # ===== TIER 2: Processing (56 total) =====
    "chip_factory": {
        "name": {"en": "Chip Factory", "ru": "Завод микросхем"},
        "icon": "🏭",
        "tier": 2,
        "count": 8,
        "price_ton": 31.0,
        "monthly_income_ton": 31.0,
    },
    "ai_lab": {
        "name": {"en": "AI Lab", "ru": "AI Лаборатория"},
        "icon": "🧪",
        "tier": 2,
        "count": 8,
        "price_ton": 36.8,
        "monthly_income_ton": 36.8,
    },
    "nft_studio": {
        "name": {"en": "NFT Studio", "ru": "NFT Студия"},
        "icon": "🎨",
        "tier": 2,
        "count": 8,
        "price_ton": 36.0,
        "monthly_income_ton": 36.0,
    },
    "vr_club": {
        "name": {"en": "VR Club", "ru": "VR Клуб"},
        "icon": "👓",
        "tier": 2,
        "count": 8,
        "price_ton": 32.5,
        "monthly_income_ton": 32.5,
    },
    "logistics": {
        "name": {"en": "Logistics", "ru": "Логистика"},
        "icon": "🚁",
        "tier": 2,
        "count": 8,
        "price_ton": 41.7,
        "monthly_income_ton": 41.7,
    },
    "cyber_cafe": {
        "name": {"en": "Cyber Cafe", "ru": "Кибер-кафе"},
        "icon": "☕",
        "tier": 2,
        "count": 8,
        "price_ton": 35.2,
        "monthly_income_ton": 35.2,
    },
    "repair_zone": {
        "name": {"en": "Repair Zone", "ru": "Ремонтная зона"},
        "icon": "🛠️",
        "tier": 2,
        "count": 8,
        "price_ton": 36.8,
        "monthly_income_ton": 36.8,
    },
    
    # ===== TIER 3: Infrastructure (25 total) - Core zone only =====
    "validator": {
        "name": {"en": "Validator", "ru": "Валидатор"},
        "icon": "🛡️",
        "tier": 3,
        "count": 4,
        "price_ton": 286.0,
        "monthly_income_ton": 286.0,
    },
    "gram_bank": {
        "name": {"en": "Gram Bank", "ru": "Банк Gram"},
        "icon": "🏦",
        "tier": 3,
        "count": 3,
        "price_ton": 278.4,
        "monthly_income_ton": 278.4,
    },
    "dex": {
        "name": {"en": "DEX", "ru": "DEX Биржа"},
        "icon": "💹",
        "tier": 3,
        "count": 4,
        "price_ton": 290.0,
        "monthly_income_ton": 290.0,
    },
    "casino": {
        "name": {"en": "Casino", "ru": "Казино"},
        "icon": "🎰",
        "tier": 3,
        "count": 4,
        "price_ton": 288.0,
        "monthly_income_ton": 288.0,
    },
    "arena": {
        "name": {"en": "Arena", "ru": "Арена"},
        "icon": "🏟️",
        "tier": 3,
        "count": 4,  # Most expensive - one goes to center
        "price_ton": 294.5,
        "monthly_income_ton": 294.5,
    },
    "incubator": {
        "name": {"en": "Incubator", "ru": "Инкубатор"},
        "icon": "🐣",
        "tier": 3,
        "count": 3,
        "price_ton": 280.0,
        "monthly_income_ton": 280.0,
    },
    "bridge": {
        "name": {"en": "Bridge", "ru": "Мост"},
        "icon": "🌉",
        "tier": 3,
        "count": 3,
        "price_ton": 265.7,
        "monthly_income_ton": 265.7,
    },
}

# ==============================================
# ISLAND CONFIGURATION
# ==============================================
ISLAND_CONFIG = {
    "id": "ton_island",
    "name": {"en": "TON Island", "ru": "Остров TON"},
    "total_cells": 528,
    "shape": "diamond",
}

# Zone configuration (from center outward)
# Adjusted ratios to get: Core=25, Center=56, Middle+Outer=447
ZONES = {
    "core": {
        "name": {"en": "Core", "ru": "Ядро"},
        "color": "#7dd3fc",
        "tier_allowed": [3],
        "target_count": 25,
    },
    "center": {
        "name": {"en": "Center", "ru": "Центр"},
        "color": "#60a5fa",
        "tier_allowed": [2],
        "target_count": 56,
    },
    "middle": {
        "name": {"en": "Middle", "ru": "Средняя"},
        "color": "#3b82f6",
        "tier_allowed": [1],
        "target_count": 200,  # Approximate
    },
    "outer": {
        "name": {"en": "Outer", "ru": "Внешняя"},
        "color": "#2563eb",
        "tier_allowed": [1],
        "target_count": 247,  # Remaining
    },
}

# Empty plots (50 total, NOT in core)
EMPTY_PLOTS_COUNT = 50


def generate_diamond_grid(target_cells: int = 528) -> Tuple[List[List[int]], int, int]:
    """
    Generate a diamond-shaped grid (TON logo style).
    Adjusted to hit exactly 528 cells.
    """
    # Use radius 16 to get ~528 cells (same as original)
    radius = 16
    size = radius * 2 + 1  # 33x33 grid
    
    grid = []
    total_land = 0
    
    for y in range(size):
        row = []
        for x in range(size):
            center = radius
            dx = abs(x - center)
            dy = abs(y - center)
            diamond_dist = dx + dy
            
            if diamond_dist <= radius:
                # TON symbol cutout at top
                if y < center:
                    top_cutout_depth = radius // 3
                    if y < top_cutout_depth:
                        cutout_width = (top_cutout_depth - y) * 2
                        if abs(x - center) <= cutout_width // 2:
                            row.append(0)
                            continue
                
                row.append(1)
                total_land += 1
            else:
                row.append(0)
        grid.append(row)
    
    return grid, size, size


def assign_zones_and_businesses(cells: List[Dict], center_x: int, center_y: int, max_dist: int) -> List[Dict]:
    """
    Assign zones and pre-set businesses to cells.
    """
    random.seed(42)  # Fixed seed for reproducibility
    
    # Sort cells by distance from center
    for cell in cells:
        dx = abs(cell["x"] - center_x)
        dy = abs(cell["y"] - center_y)
        cell["_dist"] = dx + dy
    
    cells.sort(key=lambda c: c["_dist"])
    
    # Assign zones based on target counts
    core_cells = cells[:25]
    center_cells = cells[25:81]  # 25 + 56 = 81
    remaining_cells = cells[81:]  # 447 cells for middle + outer
    
    # Split remaining into middle and outer
    middle_count = len(remaining_cells) // 2
    middle_cells = remaining_cells[:middle_count]
    outer_cells = remaining_cells[middle_count:]
    
    # Set zones
    for cell in core_cells:
        cell["zone"] = "core"
    for cell in center_cells:
        cell["zone"] = "center"
    for cell in middle_cells:
        cell["zone"] = "middle"
    for cell in outer_cells:
        cell["zone"] = "outer"
    
    # ===== ASSIGN TIER 3 TO CORE (25 businesses) =====
    tier3_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] == 3:
            tier3_pool.extend([b_id] * b["count"])
    
    # Put Arena (most expensive) in the very center
    center_cell = core_cells[0]  # Closest to center
    center_cell["pre_business"] = "arena"
    center_cell["is_center"] = True
    tier3_pool.remove("arena")
    
    # Shuffle and assign rest of Tier 3
    random.shuffle(tier3_pool)
    for i, cell in enumerate(core_cells[1:]):
        if i < len(tier3_pool):
            cell["pre_business"] = tier3_pool[i]
    
    # ===== ASSIGN TIER 2 TO CENTER (56 businesses) =====
    tier2_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] == 2:
            tier2_pool.extend([b_id] * b["count"])
    
    random.shuffle(tier2_pool)
    random.shuffle(center_cells)
    for i, cell in enumerate(center_cells):
        if i < len(tier2_pool):
            cell["pre_business"] = tier2_pool[i]
    
    # ===== ASSIGN TIER 1 TO MIDDLE+OUTER (397 businesses + 50 empty) =====
    tier1_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] == 1:
            tier1_pool.extend([b_id] * b["count"])
    
    all_tier1_cells = middle_cells + outer_cells
    random.shuffle(all_tier1_cells)
    
    # Reserve 50 empty plots
    empty_indices = set(random.sample(range(len(all_tier1_cells)), min(EMPTY_PLOTS_COUNT, len(all_tier1_cells))))
    
    random.shuffle(tier1_pool)
    tier1_idx = 0
    
    for i, cell in enumerate(all_tier1_cells):
        if i in empty_indices:
            cell["is_empty"] = True
            cell["pre_business"] = None
        elif tier1_idx < len(tier1_pool):
            cell["pre_business"] = tier1_pool[tier1_idx]
            tier1_idx += 1
    
    # Combine all cells back
    all_cells = core_cells + center_cells + all_tier1_cells
    
    # Clean up temp fields and set prices
    for cell in all_cells:
        cell.pop("_dist", None)
        
        # Set price based on business
        business_type = cell.get("pre_business")
        if business_type and business_type in CITY_BUSINESSES:
            biz = CITY_BUSINESSES[business_type]
            cell["price_ton"] = biz["price_ton"]
            cell["price_city"] = ton_to_city(biz["price_ton"])
            cell["business_icon"] = biz["icon"]
            cell["business_name"] = biz["name"]
            cell["business_tier"] = biz["tier"]
            cell["monthly_income_ton"] = biz["monthly_income_ton"]
            cell["monthly_income_city"] = ton_to_city(biz["monthly_income_ton"])
        else:
            # Empty plot - base price for building later
            cell["price_ton"] = 5.0  # Base empty plot price
            cell["price_city"] = ton_to_city(5.0)
            cell["is_empty"] = True
    
    return all_cells


def generate_ton_island_map() -> Dict:
    """
    Generate the complete TON Island map with 528 cells and pre-assigned businesses.
    """
    grid, width, height = generate_diamond_grid(528)
    
    cells = []
    center_x = width // 2
    center_y = height // 2
    max_dist = width // 2
    
    for y in range(height):
        for x in range(width):
            if grid[y][x] == 1:
                cells.append({
                    "x": x,
                    "y": y,
                    "is_available": True,
                    "owner": None,
                })
    
    # Assign zones and businesses
    cells = assign_zones_and_businesses(cells, center_x, center_y, max_dist)
    
    # Zone statistics
    zone_stats = {"core": 0, "center": 0, "middle": 0, "outer": 0}
    business_stats = {"tier1": 0, "tier2": 0, "tier3": 0, "empty": 0}
    
    for cell in cells:
        zone_stats[cell.get("zone", "outer")] += 1
        if cell.get("is_empty"):
            business_stats["empty"] += 1
        elif cell.get("pre_business"):
            tier = CITY_BUSINESSES.get(cell["pre_business"], {}).get("tier", 1)
            business_stats[f"tier{tier}"] += 1
    
    return {
        "id": ISLAND_CONFIG["id"],
        "name": ISLAND_CONFIG["name"],
        "grid": grid,
        "width": width,
        "height": height,
        "cells": cells,
        "total_cells": len(cells),
        "zone_stats": zone_stats,
        "business_stats": business_stats,
        "zones": ZONES,
        "businesses": CITY_BUSINESSES,
        "city_rate": CITY_RATE,
    }


def get_cell_at(island_data: Dict, x: int, y: int) -> Dict:
    """Get cell data at specific coordinates"""
    for cell in island_data["cells"]:
        if cell["x"] == x and cell["y"] == y:
            return cell
    return None


def get_neighbors(island_data: Dict, x: int, y: int) -> List[Dict]:
    """Get neighboring cells"""
    neighbors = []
    offsets = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    
    for dx, dy in offsets:
        cell = get_cell_at(island_data, x + dx, y + dy)
        if cell:
            neighbors.append(cell)
    
    return neighbors


def get_buildable_businesses() -> List[Dict]:
    """
    Get list of businesses that can be built on empty plots.
    Only Tier 1 and Tier 2 allowed (Tier 3 zone is fully occupied).
    """
    result = []
    for b_id, b in CITY_BUSINESSES.items():
        if b["tier"] in [1, 2]:  # Only Tier 1 and 2
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
    island = generate_ton_island_map()
    print(f"Island generated: {island['total_cells']} cells")
    print(f"Zone distribution: {island['zone_stats']}")
    print(f"Business distribution: {island['business_stats']}")
    
    # Verify counts
    expected_tier1 = sum(b["count"] for b in CITY_BUSINESSES.values() if b["tier"] == 1)
    expected_tier2 = sum(b["count"] for b in CITY_BUSINESSES.values() if b["tier"] == 2)
    expected_tier3 = sum(b["count"] for b in CITY_BUSINESSES.values() if b["tier"] == 3)
    print(f"\nExpected: Tier1={expected_tier1}, Tier2={expected_tier2}, Tier3={expected_tier3}, Empty={EMPTY_PLOTS_COUNT}")
    print(f"Total expected: {expected_tier1 + expected_tier2 + expected_tier3 + EMPTY_PLOTS_COUNT}")
