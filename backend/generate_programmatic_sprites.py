"""
Generate clean isometric building sprites for TON City Builder.
All sprites: 256x256 PNG, transparent background, same visual size.
Building occupies ~60% of frame (Tier 2 standard).
Cyberpunk style with neon accents.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import math
import random

OUTPUT_DIR = "/app/frontend/public/sprites/buildings"

# Building configs: type -> (main_color, accent_color, label, shape_style)
BUILDINGS = {
    "helios": ((30, 180, 120), (0, 255, 180), "HS", "solar"),
    "nano_dc": ((60, 100, 180), (0, 200, 255), "DC", "box"),
    "quartz_mine": ((140, 100, 50), (255, 180, 0), "QM", "mine"),
    "signal": ((80, 60, 160), (160, 100, 255), "ST", "tower"),
    "hydro": ((30, 100, 160), (0, 180, 255), "HC", "tank"),
    "biofood": ((40, 140, 60), (80, 255, 100), "BF", "dome"),
    "scrap": ((100, 80, 60), (200, 150, 50), "SC", "box"),
    "chips": ((60, 60, 100), (100, 150, 255), "CF", "factory"),
    "nft_studio": ((120, 40, 140), (200, 80, 255), "NS", "box"),
    "ai_lab": ((40, 60, 120), (0, 200, 255), "AI", "dome"),
    "logistics": ((80, 80, 80), (255, 200, 0), "LH", "warehouse"),
    "cyber_cafe": ((100, 30, 80), (255, 50, 150), "CC", "box"),
    "repair_shop": ((80, 100, 60), (200, 255, 0), "RS", "box"),
    "vr_club": ((60, 20, 100), (150, 50, 255), "VR", "dome"),
    "validator": ((30, 30, 60), (0, 255, 200), "VL", "tower"),
    "gram_bank": ((40, 40, 80), (255, 200, 0), "GB", "skyscraper"),
    "dex": ((20, 50, 80), (0, 200, 255), "DX", "box"),
    "casino": ((80, 20, 40), (255, 50, 100), "CA", "dome"),
    "arena": ((60, 40, 30), (255, 100, 0), "AR", "factory"),
    "incubator": ((40, 80, 60), (100, 255, 150), "IC", "dome"),
    "bridge": ((50, 50, 80), (100, 200, 255), "BR", "tower"),
}

def draw_isometric_box(draw, cx, cy, w, h, d, color, accent):
    """Draw an isometric box (building) centered at (cx, cy_bottom)."""
    r, g, b = color
    top_color = (min(r+40,255), min(g+40,255), min(b+40,255))
    right_color = (max(r-20,0), max(g-20,0), max(b-20,0))
    left_color = (max(r-40,0), max(g-40,0), max(b-40,0))
    
    hw, hd = w // 2, d // 2
    
    # Top face
    top = [
        (cx, cy - h - hd),
        (cx + hw, cy - h - hd + hd//2),
        (cx, cy - h),
        (cx - hw, cy - h - hd + hd//2),
    ]
    draw.polygon(top, fill=top_color, outline=(min(r+80,255), min(g+80,255), min(b+80,255)))
    
    # Left face
    left = [
        (cx - hw, cy - h - hd + hd//2),
        (cx, cy - h),
        (cx, cy),
        (cx - hw, cy - hd + hd//2),
    ]
    draw.polygon(left, fill=left_color, outline=(min(r+20,255), min(g+20,255), min(b+20,255)))
    
    # Right face
    right = [
        (cx, cy - h),
        (cx + hw, cy - h - hd + hd//2),
        (cx + hw, cy - hd + hd//2),
        (cx, cy),
    ]
    draw.polygon(right, fill=right_color, outline=(min(r+20,255), min(g+20,255), min(b+20,255)))
    
    return top, left, right

def add_windows(draw, face_points, accent, rows=3, cols=2):
    """Add glowing window rectangles to a face."""
    ar, ag, ab = accent
    win_color = (ar, ag, ab, 200)
    
    xs = [p[0] for p in face_points]
    ys = [p[1] for p in face_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    pw = (max_x - min_x) / (cols + 1)
    ph = (max_y - min_y) / (rows + 1)
    
    for r in range(rows):
        for c in range(cols):
            wx = min_x + pw * (c + 0.7)
            wy = min_y + ph * (r + 0.7)
            ww = pw * 0.4
            wh = ph * 0.35
            draw.rectangle([wx, wy, wx+ww, wy+wh], fill=win_color)

def add_neon_line(draw, y, cx, w, accent):
    """Add a horizontal neon accent line."""
    ar, ag, ab = accent
    draw.line([(cx - w//2 + 5, y), (cx + w//2 - 5, y)], fill=(ar, ag, ab, 220), width=2)

def add_label(draw, cx, cy, label, accent):
    """Add a building type label."""
    ar, ag, ab = accent
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except:
        font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw//2, cy - th//2), label, fill=(ar, ag, ab, 230), font=font)

def generate_sprite(building_type, level, config):
    """Generate a single building sprite."""
    main_color, accent, label, style = config
    
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, 'RGBA')
    
    cx = 128  # center x
    base_y = 200  # bottom of building (within 60% area = 154px from top)
    
    # Building dimensions scale slightly with level
    level_scale = 0.85 + (level / 10) * 0.15  # 0.85 to 1.0
    
    # Base dimensions for Tier 2 standard (60% of frame)
    bw = int(80 * level_scale)  # width
    bh = int(90 * level_scale)  # height
    bd = int(60 * level_scale)  # depth
    
    # Slight color variation per level
    r, g, b = main_color
    lv = level * 3
    main = (min(r+lv, 255), min(g+lv, 255), min(b+lv, 255))
    
    # Draw main building
    top, left, right = draw_isometric_box(draw, cx, base_y, bw, bh, bd, main, accent)
    
    # Add details based on level
    if level >= 2:
        add_windows(draw, right, accent, rows=min(level, 5), cols=2)
    if level >= 3:
        add_windows(draw, left, accent, rows=min(level, 5), cols=2)
    if level >= 4:
        add_neon_line(draw, base_y - bh//2, cx, bw, accent)
    if level >= 6:
        add_neon_line(draw, base_y - bh*3//4, cx, bw-10, accent)
    
    # Add roof antenna/detail for higher levels
    if level >= 7:
        antenna_h = 10 + level * 2
        ar, ag, ab = accent
        draw.line([(cx, base_y - bh - bd//4), (cx, base_y - bh - bd//4 - antenna_h)], 
                  fill=(ar, ag, ab, 200), width=2)
        draw.ellipse([(cx-3, base_y - bh - bd//4 - antenna_h - 3),
                      (cx+3, base_y - bh - bd//4 - antenna_h + 3)],
                     fill=(ar, ag, ab, 255))
    
    # Add building label
    add_label(draw, cx, base_y - bh//2, label, accent)
    
    # Add level indicator (small number at bottom-right)
    if level > 1:
        try:
            font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
        except:
            font_sm = ImageFont.load_default()
        draw.text((cx + bw//2 - 5, base_y - 15), str(level), fill=(255, 255, 255, 200), font=font_sm)
    
    return img

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    total = len(BUILDINGS) * 10
    count = 0
    
    for btype, config in BUILDINGS.items():
        for level in range(1, 11):
            count += 1
            filename = f"{btype}_lvl{level}.png"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            img = generate_sprite(btype, level, config)
            img.save(filepath, 'PNG', optimize=True)
            
            if count % 21 == 0:
                print(f"[{count}/{total}] Generated {filename}")
    
    print(f"Done! Generated {count} sprites in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
