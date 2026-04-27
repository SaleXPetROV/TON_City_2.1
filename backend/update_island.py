"""
Script to update existing TON Island with pre-assigned businesses.
This preserves the existing island shape (528 cells) and adds businesses.
"""
import asyncio
import random
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# Import business config
from ton_island import CITY_BUSINESSES, ton_to_city, ZONES

async def update_island_with_businesses():
    """Update existing island in DB with pre-assigned businesses."""
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME')]
    
    # Get existing island
    island = await db.islands.find_one({'id': 'ton_island'})
    if not island:
        print("No island found in DB!")
        client.close()
        return
    
    cells = island.get('cells', [])
    print(f"Found island with {len(cells)} cells")
    
    # Get current zone distribution
    zone_counts = {}
    for c in cells:
        z = c.get('zone', 'unknown')
        zone_counts[z] = zone_counts.get(z, 0) + 1
    print(f"Current zones: {zone_counts}")
    
    # Map old zone names to new if needed
    # Current: core=25, inner=60, middle=180, outer=263
    # Need: core=25 (tier3), center=56 (tier2), middle+outer=447 (tier1 + empty)
    
    random.seed(42)
    
    # Sort cells by distance from center (assuming center is at grid center)
    width = island.get('width', 33)
    height = island.get('height', 33)
    center_x = width // 2
    center_y = height // 2
    
    for cell in cells:
        dx = abs(cell['x'] - center_x)
        dy = abs(cell['y'] - center_y)
        cell['_dist'] = dx + dy
    
    cells.sort(key=lambda c: c['_dist'])
    
    # Assign zones based on required counts
    # Core: 25 cells (closest to center) - Tier 3
    # Center: 56 cells - Tier 2
    # Middle+Outer: 447 cells - Tier 1 (397) + Empty (50)
    
    core_cells = cells[:25]
    center_cells = cells[25:81]  # 56 cells
    outer_cells = cells[81:]  # 447 cells
    
    # Update zones
    for cell in core_cells:
        cell['zone'] = 'core'
    for cell in center_cells:
        cell['zone'] = 'center'
    for cell in outer_cells:
        # Split into middle and outer
        if cell['_dist'] < center_x * 0.7:
            cell['zone'] = 'middle'
        else:
            cell['zone'] = 'outer'
    
    # ===== ASSIGN TIER 3 TO CORE (25 businesses) =====
    tier3_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b['tier'] == 3:
            tier3_pool.extend([b_id] * b['count'])
    
    print(f"Tier 3 pool: {len(tier3_pool)} businesses")
    
    # Put Arena (most expensive) in the very center
    core_cells[0]['pre_business'] = 'arena'
    core_cells[0]['is_center'] = True
    tier3_pool.remove('arena')
    
    # Assign rest of Tier 3
    random.shuffle(tier3_pool)
    for i, cell in enumerate(core_cells[1:]):
        if i < len(tier3_pool):
            cell['pre_business'] = tier3_pool[i]
    
    # ===== ASSIGN TIER 2 TO CENTER (56 businesses) =====
    tier2_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b['tier'] == 2:
            tier2_pool.extend([b_id] * b['count'])
    
    print(f"Tier 2 pool: {len(tier2_pool)} businesses")
    
    random.shuffle(tier2_pool)
    random.shuffle(center_cells)
    for i, cell in enumerate(center_cells):
        if i < len(tier2_pool):
            cell['pre_business'] = tier2_pool[i]
    
    # ===== ASSIGN TIER 1 TO OUTER (397 businesses + 50 empty) =====
    tier1_pool = []
    for b_id, b in CITY_BUSINESSES.items():
        if b['tier'] == 1:
            tier1_pool.extend([b_id] * b['count'])
    
    print(f"Tier 1 pool: {len(tier1_pool)} businesses")
    print(f"Outer cells: {len(outer_cells)}")
    
    # Reserve 50 empty plots
    random.shuffle(outer_cells)
    empty_indices = set(range(50))  # First 50 after shuffle are empty
    
    random.shuffle(tier1_pool)
    tier1_idx = 0
    
    for i, cell in enumerate(outer_cells):
        if i in empty_indices:
            cell['is_empty'] = True
            cell['pre_business'] = None
        elif tier1_idx < len(tier1_pool):
            cell['pre_business'] = tier1_pool[tier1_idx]
            tier1_idx += 1
    
    # Combine and set prices/info for all cells
    all_cells = core_cells + center_cells + outer_cells
    
    for cell in all_cells:
        cell.pop('_dist', None)
        
        business_type = cell.get('pre_business')
        if business_type and business_type in CITY_BUSINESSES:
            biz = CITY_BUSINESSES[business_type]
            cell['price'] = biz['price_ton']
            cell['price_ton'] = biz['price_ton']
            cell['price_city'] = ton_to_city(biz['price_ton'])
            cell['business_icon'] = biz['icon']
            cell['business_name'] = biz['name']
            cell['business_tier'] = biz['tier']
            cell['monthly_income_ton'] = biz['monthly_income_ton']
            cell['monthly_income_city'] = ton_to_city(biz['monthly_income_ton'])
        else:
            # Empty plot
            cell['price'] = 5.0
            cell['price_ton'] = 5.0
            cell['price_city'] = ton_to_city(5.0)
            cell['is_empty'] = True
    
    # Calculate stats
    zone_stats = {'core': 0, 'center': 0, 'middle': 0, 'outer': 0}
    business_stats = {'tier1': 0, 'tier2': 0, 'tier3': 0, 'empty': 0}
    
    for cell in all_cells:
        zone_stats[cell.get('zone', 'outer')] += 1
        if cell.get('is_empty'):
            business_stats['empty'] += 1
        elif cell.get('pre_business'):
            tier = CITY_BUSINESSES.get(cell['pre_business'], {}).get('tier', 1)
            business_stats[f'tier{tier}'] += 1
    
    print(f"\nNew zone distribution: {zone_stats}")
    print(f"Business distribution: {business_stats}")
    
    # Update island in DB
    island['cells'] = all_cells
    island['zone_stats'] = zone_stats
    island['business_stats'] = business_stats
    island['businesses'] = CITY_BUSINESSES
    island['city_rate'] = 1000  # 1 TON = 1000 $CITY
    
    await db.islands.replace_one({'id': 'ton_island'}, island)
    print("\n✅ Island updated in database!")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(update_island_with_businesses())
