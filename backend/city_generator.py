"""
City Generator Module for TON City Builder
Generates cities with organic/chaotic shapes
"""
import random
import math
from typing import List, Dict, Tuple
import uuid
from datetime import datetime, timezone

def generate_organic_shape(target_cells: int = 450, width: int = 30, height: int = 25) -> List[List[int]]:
    """
    Generate an organic blob-like shape using cellular automata
    Returns a 2D grid where 1 = land, 0 = water
    """
    # Initialize with random noise
    grid = [[1 if random.random() < 0.45 else 0 for _ in range(width)] for _ in range(height)]
    
    # Apply cellular automata rules (smoothing)
    for _ in range(5):
        new_grid = [[0] * width for _ in range(height)]
        for y in range(height):
            for x in range(width):
                neighbors = 0
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < height and 0 <= nx < width:
                            neighbors += grid[ny][nx]
                # Birth/survival rules
                if neighbors >= 5:
                    new_grid[y][x] = 1
                elif neighbors <= 2:
                    new_grid[y][x] = 0
                else:
                    new_grid[y][x] = grid[y][x]
        grid = new_grid
    
    # Find the largest connected component (flood fill)
    visited = [[False] * width for _ in range(height)]
    largest_component = []
    
    def flood_fill(start_y: int, start_x: int) -> List[Tuple[int, int]]:
        component = []
        stack = [(start_y, start_x)]
        while stack:
            y, x = stack.pop()
            if 0 <= y < height and 0 <= x < width and not visited[y][x] and grid[y][x] == 1:
                visited[y][x] = True
                component.append((y, x))
                for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    stack.append((y + dy, x + dx))
        return component
    
    for y in range(height):
        for x in range(width):
            if grid[y][x] == 1 and not visited[y][x]:
                component = flood_fill(y, x)
                if len(component) > len(largest_component):
                    largest_component = component
    
    # Create clean grid with only the largest component
    final_grid = [[0] * width for _ in range(height)]
    for y, x in largest_component:
        final_grid[y][x] = 1
    
    # Adjust to target cell count
    current_cells = len(largest_component)
    cells_to_add = target_cells - current_cells
    
    if cells_to_add > 0:
        # Add cells at edges
        for _ in range(cells_to_add):
            edge_cells = []
            for y in range(height):
                for x in range(width):
                    if final_grid[y][x] == 0:
                        # Check if adjacent to land
                        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < height and 0 <= nx < width and final_grid[ny][nx] == 1:
                                edge_cells.append((y, x))
                                break
            if edge_cells:
                y, x = random.choice(edge_cells)
                final_grid[y][x] = 1
    elif cells_to_add < 0:
        # Remove cells from edges
        for _ in range(abs(cells_to_add)):
            edge_cells = []
            for y in range(height):
                for x in range(width):
                    if final_grid[y][x] == 1:
                        land_neighbors = 0
                        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < height and 0 <= nx < width and final_grid[ny][nx] == 1:
                                land_neighbors += 1
                        if land_neighbors < 4:
                            edge_cells.append((y, x))
            if edge_cells:
                y, x = random.choice(edge_cells)
                final_grid[y][x] = 0
    
    return final_grid


def generate_ton_logo_shape(target_cells: int = 480) -> List[List[int]]:
    """
    Generate a shape resembling the TON diamond logo
    """
    width, height = 32, 32
    grid = [[0] * width for _ in range(height)]
    
    # TON logo is a diamond/gem shape
    center_x, center_y = width // 2, height // 2
    
    # Create diamond outline
    diamond_points = []
    
    # Top point
    top_y = 2
    # Bottom point  
    bottom_y = height - 3
    # Left point
    left_x = 3
    # Right point
    right_x = width - 4
    
    # Draw filled diamond
    for y in range(height):
        for x in range(width):
            # Calculate if point is inside diamond
            # Using distance from center with diamond metric
            dx = abs(x - center_x)
            dy = abs(y - center_y)
            
            # Diamond shape formula
            half_width = (right_x - left_x) / 2
            half_height = (bottom_y - top_y) / 2
            
            if dx / half_width + dy / half_height <= 1:
                grid[y][x] = 1
    
    # Add the characteristic TON cut in the middle (the line through the diamond)
    # Horizontal line through center
    for x in range(left_x + 2, right_x - 1):
        if grid[center_y][x] == 1:
            # Create slight indent effect
            pass
    
    # Add angular cuts at top to create faceted look
    for i in range(5):
        if top_y + i < height and left_x + i + 3 < width:
            grid[top_y + i][center_x] = 1
    
    # Count cells and adjust
    cell_count = sum(sum(row) for row in grid)
    
    # Scale if needed
    if cell_count < target_cells * 0.8:
        # Expand the shape
        new_grid = [[0] * width for _ in range(height)]
        for y in range(height):
            for x in range(width):
                if grid[y][x] == 1:
                    new_grid[y][x] = 1
                    for dy in range(-1, 2):
                        for dx in range(-1, 2):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < height and 0 <= nx < width:
                                if random.random() < 0.6:
                                    new_grid[ny][nx] = 1
        grid = new_grid
    
    return grid


def generate_archipelago_shape(target_cells: int = 450, islands: int = 4) -> List[List[int]]:
    """
    Generate a group of connected islands
    """
    width, height = 35, 30
    grid = [[0] * width for _ in range(height)]
    
    cells_per_island = target_cells // islands
    island_centers = []
    
    # Generate island centers
    for i in range(islands):
        attempts = 0
        while attempts < 100:
            cx = random.randint(5, width - 6)
            cy = random.randint(5, height - 6)
            # Check distance from other centers
            too_close = False
            for ocx, ocy in island_centers:
                if abs(cx - ocx) < 8 and abs(cy - ocy) < 8:
                    too_close = True
                    break
            if not too_close:
                island_centers.append((cx, cy))
                break
            attempts += 1
    
    # Generate each island
    for cx, cy in island_centers:
        radius = int(math.sqrt(cells_per_island / math.pi))
        for y in range(max(0, cy - radius - 2), min(height, cy + radius + 3)):
            for x in range(max(0, cx - radius - 2), min(width, cx + radius + 3)):
                dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                # Add some noise to make it organic
                noise = random.uniform(-1.5, 1.5)
                if dist + noise < radius:
                    grid[y][x] = 1
    
    # Connect islands with thin land bridges
    for i in range(len(island_centers) - 1):
        x1, y1 = island_centers[i]
        x2, y2 = island_centers[i + 1]
        
        # Draw thin bridge
        steps = max(abs(x2 - x1), abs(y2 - y1))
        for t in range(steps + 1):
            x = int(x1 + (x2 - x1) * t / steps)
            y = int(y1 + (y2 - y1) * t / steps)
            if 0 <= y < height and 0 <= x < width:
                grid[y][x] = 1
                # Make bridge slightly wider
                if random.random() < 0.5:
                    if y + 1 < height:
                        grid[y + 1][x] = 1
                    if x + 1 < width:
                        grid[y][x + 1] = 1
    
    return grid


def generate_crescent_shape(target_cells: int = 450) -> List[List[int]]:
    """
    Generate a crescent/bay shape
    """
    width, height = 30, 28
    grid = [[0] * width for _ in range(height)]
    
    center_x, center_y = width // 2, height // 2
    outer_radius = 12
    inner_radius = 7
    inner_offset_x = 4
    
    for y in range(height):
        for x in range(width):
            # Outer circle
            dist_outer = math.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
            # Inner circle (offset)
            dist_inner = math.sqrt((x - center_x - inner_offset_x) ** 2 + (y - center_y) ** 2)
            
            noise = random.uniform(-0.8, 0.8)
            
            if dist_outer + noise < outer_radius and dist_inner + noise > inner_radius:
                grid[y][x] = 1
    
    return grid


def create_demo_cities() -> List[Dict]:
    """
    Create demo cities for the game
    """
    cities = []
    
    # City 1: TON Island (TON logo shape)
    ton_grid = generate_ton_logo_shape(480)
    cities.append({
        "id": "ton-island",
        "name": {"en": "TON Island", "ru": "Остров TON"},
        "description": {
            "en": "The heart of the TON ecosystem. Premium location with high traffic.",
            "ru": "Сердце экосистемы TON. Премиальное расположение с высоким трафиком."
        },
        "grid": ton_grid,
        "style": "cyber",
        "base_price": 15.0,
        "price_multiplier": 1.5,
        "stats": {
            "total_plots": sum(sum(row) for row in ton_grid),
            "owned_plots": 0,
            "total_businesses": 0,
            "monthly_volume": 0,
            "active_players": 0
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # City 2: Nebula Bay (crescent shape)
    crescent_grid = generate_crescent_shape(460)
    cities.append({
        "id": "nebula-bay",
        "name": {"en": "Nebula Bay", "ru": "Залив Небула"},
        "description": {
            "en": "A natural harbor perfect for trading businesses.",
            "ru": "Природная гавань, идеальная для торговых предприятий."
        },
        "grid": crescent_grid,
        "style": "tropical",
        "base_price": 8.0,
        "price_multiplier": 1.0,
        "stats": {
            "total_plots": sum(sum(row) for row in crescent_grid),
            "owned_plots": 0,
            "total_businesses": 0,
            "monthly_volume": 0,
            "active_players": 0
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # City 3: Nova Archipelago (multiple islands)
    archipelago_grid = generate_archipelago_shape(470, 4)
    cities.append({
        "id": "nova-archipelago",
        "name": {"en": "Nova Archipelago", "ru": "Архипелаг Нова"},
        "description": {
            "en": "A chain of islands connected by bridges. Strategic diversity.",
            "ru": "Цепь островов, соединённых мостами. Стратегическое разнообразие."
        },
        "grid": archipelago_grid,
        "style": "industrial",
        "base_price": 6.0,
        "price_multiplier": 0.8,
        "stats": {
            "total_plots": sum(sum(row) for row in archipelago_grid),
            "owned_plots": 0,
            "total_businesses": 0,
            "monthly_volume": 0,
            "active_players": 0
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # City 4: Genesis Plains (organic blob)
    organic_grid = generate_organic_shape(450, 28, 24)
    cities.append({
        "id": "genesis-plains",
        "name": {"en": "Genesis Plains", "ru": "Равнины Генезис"},
        "description": {
            "en": "The original settlement. Affordable plots for newcomers.",
            "ru": "Изначальное поселение. Доступные участки для новичков."
        },
        "grid": organic_grid,
        "style": "neon",
        "base_price": 5.0,
        "price_multiplier": 0.7,
        "stats": {
            "total_plots": sum(sum(row) for row in organic_grid),
            "owned_plots": 0,
            "total_businesses": 0,
            "monthly_volume": 0,
            "active_players": 0
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # City 5: Crystal Reef (another organic shape)
    reef_grid = generate_organic_shape(480, 30, 26)
    cities.append({
        "id": "crystal-reef",
        "name": {"en": "Crystal Reef", "ru": "Кристальный Риф"},
        "description": {
            "en": "Rich in resources. Perfect for production chains.",
            "ru": "Богат ресурсами. Идеален для производственных цепочек."
        },
        "grid": reef_grid,
        "style": "cyber",
        "base_price": 10.0,
        "price_multiplier": 1.2,
        "stats": {
            "total_plots": sum(sum(row) for row in reef_grid),
            "owned_plots": 0,
            "total_businesses": 0,
            "monthly_volume": 0,
            "active_players": 0
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return cities


def calculate_plot_price_in_city(city: Dict, x: int, y: int) -> float:
    """
    Calculate plot price based on position in city
    Center plots are more expensive
    """
    grid = city["grid"]
    height = len(grid)
    width = len(grid[0]) if grid else 0
    
    # Find center of mass
    total_x, total_y, count = 0, 0, 0
    for gy in range(height):
        for gx in range(width):
            if grid[gy][gx] == 1:
                total_x += gx
                total_y += gy
                count += 1
    
    if count == 0:
        return city["base_price"]
    
    center_x = total_x / count
    center_y = total_y / count
    
    # Distance from center
    max_dist = max(width, height) / 2
    dist = math.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
    dist_factor = 1 - (dist / max_dist) * 0.5  # Center is 1.0, edge is 0.5
    
    price = city["base_price"] * city["price_multiplier"] * dist_factor
    return round(price, 2)
