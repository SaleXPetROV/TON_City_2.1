"""
TON City Builder - Optimized AI Sprite Generator v2.0
Generates Tier-weighted sprites with correct visual proportions.
"""
import os
import asyncio
import base64
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image
import io

load_dotenv()

# Base prompts for each building type - isometric 2.5D style
BUILDING_BASE_PROMPTS = {
    # ===== TIER 1 - Resource Buildings (Small Scale) =====
    "helios": {
        "name": "Гелиос Солар",
        "base": "small isometric solar power station",
        "tier": 1
    },
    "nano_dc": {
        "name": "Нано Дата-Центр",
        "base": "small isometric data center unit",
        "tier": 1
    },
    "quartz_mine": {
        "name": "Кварцевая Шахта",
        "base": "small isometric crystal mine entrance",
        "tier": 1
    },
    "signal": {
        "name": "Спутник Signal",
        "base": "small isometric satellite antenna",
        "tier": 1
    },
    "cooler": {
        "name": "Гидро-Охладитель",
        "base": "small isometric cooling tower",
        "tier": 1
    },
    "bio_farm": {
        "name": "Био-Принтер",
        "base": "small isometric bio greenhouse",
        "tier": 1
    },
    "scrap": {
        "name": "Нано-Сборщик",
        "base": "small isometric recycling bin with arm",
        "tier": 1
    },
    
    # ===== TIER 2 - Processing Buildings (Medium Scale) =====
    "chip_fab": {
        "name": "Завод Чипов",
        "base": "medium isometric microchip factory",
        "tier": 2
    },
    "nft_studio": {
        "name": "NFT Студия",
        "base": "medium isometric digital art studio",
        "tier": 2
    },
    "ai_lab": {
        "name": "Лаборатория ИИ",
        "base": "medium isometric AI research lab",
        "tier": 2
    },
    "hangar": {
        "name": "Логистический Ангар",
        "base": "medium isometric drone hangar",
        "tier": 2
    },
    "cafe": {
        "name": "Кибер-Кафе",
        "base": "medium isometric cyberpunk cafe",
        "tier": 2
    },
    "repair": {
        "name": "Ремонтный Цех",
        "base": "medium isometric robotic workshop",
        "tier": 2
    },
    "vr_club": {
        "name": "VR Клуб",
        "base": "medium isometric VR entertainment center",
        "tier": 2
    },
    
    # ===== TIER 3 - Infrastructure Buildings (Large/Epic Scale) =====
    "validator": {
        "name": "Валидатор-Центр",
        "base": "massive isometric blockchain tower",
        "tier": 3
    },
    "gram_bank": {
        "name": "Небоскреб Gram",
        "base": "massive isometric glass skyscraper bank",
        "tier": 3
    },
    "dex": {
        "name": "DEX Биржа",
        "base": "massive isometric decentralized exchange complex",
        "tier": 3
    },
    "casino": {
        "name": "Отель-Казино",
        "base": "massive isometric luxury casino hotel",
        "tier": 3
    },
    "arena": {
        "name": "Кибер-Арена",
        "base": "massive isometric esports stadium",
        "tier": 3
    },
    "incubator": {
        "name": "Техно-Инкубатор",
        "base": "large isometric tech campus",
        "tier": 3
    },
    "bridge": {
        "name": "Межсетевой Мост",
        "base": "massive isometric portal gateway",
        "tier": 3
    }
}

# Style suffix — transparent background for compositing on isometric map
STYLE_SUFFIX = "isometric 2.5D view, transparent background, no ground plane, high quality game asset sprite, cyberpunk neon style, dark color palette, centered on canvas"

def get_sprite_prompt(building_type: str, level: int) -> str:
    """Generate a prompt enforcing visual hierarchy inside a 256x256 canvas.
    
    Tier 1: building fills only 30-40% of frame height (small, grounded)
    Tier 2: building fills 60% of frame height (medium factory/lab)
    Tier 3: building fills 85-90% of frame height (dominant skyscraper)
    """
    config = BUILDING_BASE_PROMPTS.get(building_type)
    if not config:
        return None
    
    base = config["base"]
    tier = config["tier"]
    
    # Level evolution — higher levels add visual complexity
    if level <= 3:
        evolution = "basic construction, simple geometry, few details"
    elif level <= 6:
        evolution = "upgraded structure, added neon lights, extra floors and details"
    elif level <= 9:
        evolution = "advanced high-tech structure, glowing energy lines, holographic displays"
    else:
        evolution = "maximum evolution, epic futuristic masterpiece, intense neon glow, floating elements"
    
    # Visual hierarchy — composition within the 256x256 canvas
    if tier == 1:
        composition = (
            "TINY building sitting at the very bottom of the frame. "
            "Building occupies only the bottom 35 percent of the image height. "
            "Top 65 percent is completely empty transparent space. "
            "Small compact footprint, low-rise structure, ground-level"
        )
    elif tier == 2:
        composition = (
            "Medium-sized building centered at the bottom of the frame. "
            "Building occupies the bottom 60 percent of the image height. "
            "Top 40 percent is empty transparent space. "
            "Multi-story industrial structure with moderate footprint"
        )
    else:
        composition = (
            "MASSIVE towering building filling nearly the entire frame. "
            "Building occupies 90 percent of the image height from bottom. "
            "Only thin sliver of transparent space at top. "
            "Tall dominant skyscraper, epic monumental scale"
        )
        
    prompt = f"{base}, {composition}, {evolution}, {STYLE_SUFFIX}"
    return prompt


async def process_image(image_bytes: bytes) -> bytes:
    """
    Process the generated image:
    1. Resize to 256x256
    2. Convert to RGBA with transparent background
    3. Remove white/near-white pixels
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Resize to 256x256 using LANCZOS for quality
        img = img.resize((256, 256), Image.Resampling.LANCZOS)
        
        # Ensure RGBA mode
        img = img.convert('RGBA')
        pixels = img.load()
        w, h = img.size
        
        # Remove white/near-white background pixels
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if r > 230 and g > 230 and b > 230:
                    pixels[x, y] = (r, g, b, 0)
                elif r > 210 and g > 210 and b > 210 and abs(r - g) < 15 and abs(g - b) < 15:
                    alpha = max(0, int((255 - max(r, g, b)) * 4))
                    pixels[x, y] = (r, g, b, alpha)
        
        output = io.BytesIO()
        img.save(output, format='PNG', optimize=True)
        return output.getvalue()
        
    except Exception as e:
        print(f"Error processing image: {e}")
        return image_bytes


async def generate_building_sprite(building_type: str, level: int = 1, save_path: str = None) -> bytes:
    """
    Generate a single building sprite using OpenAI gpt-image-1
    """
    from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY not set")
    
    prompt = get_sprite_prompt(building_type, level)
    if not prompt:
        raise ValueError(f"Unknown building type: {building_type}")
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    print(f"🎨 Generating {building_type} (Tier {BUILDING_BASE_PROMPTS[building_type]['tier']}) lvl {level}...")
    
    images = await image_gen.generate_images(
        prompt=prompt,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if not images or len(images) == 0:
        raise ValueError("No image generated")
    
    # Process image (resize/optimize)
    raw_bytes = images[0]
    processed_bytes = await process_image(raw_bytes)
    
    # Save to file if path provided
    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(processed_bytes)
    
    return processed_bytes

async def generate_all_sprites(output_dir: str = "/app/frontend/public/sprites/buildings"):
    """
    Generate all 210 building sprites (21 types x 10 levels)
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    results = {"success": [], "skipped": [], "failed": []}
    total = len(BUILDING_BASE_PROMPTS) * 10
    current = 0
    
    for building_type in BUILDING_BASE_PROMPTS.keys():
        for level in range(1, 11):
            current += 1
            filename = f"{building_type}_lvl{level}.png"
            save_path = f"{output_dir}/{filename}"
            
            # Since we CHANGED THE LOGIC (visual weight), we should regenerate even if exists
            # Ideally we force overwrite or check a flag. For now, let's force overwrite certain ones or all.
            # Commenting out the skip logic to force regeneration of the "Visual Hierarchy".
            
            # if Path(save_path).exists():
            #     print(f"[{current}/{total}] Skipping {filename} - already exists")
            #     results["skipped"].append(filename)
            #     continue
            
            try:
                print(f"[{current}/{total}] Generating {filename}...")
                await generate_building_sprite(building_type, level, save_path)
                results["success"].append(filename)
                print(f"[{current}/{total}] ✅ Generated {filename}")
                
                # Delay to avoid rate limiting
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"[{current}/{total}] ❌ Failed {filename}: {e}")
                results["failed"].append({"file": filename, "error": str(e)})
    
    return results


def get_all_sprites_info():
    """Return info about all available building sprites and their status on disk."""
    output_dir = "/app/frontend/public/sprites/buildings"
    sprites = []
    for building_type, config in BUILDING_BASE_PROMPTS.items():
        for level in range(1, 11):
            filename = f"{building_type}_lvl{level}.png"
            filepath = f"{output_dir}/{filename}"
            exists = Path(filepath).exists()
            size = Path(filepath).stat().st_size if exists else 0
            sprites.append({
                "building_type": building_type,
                "name": config["name"],
                "tier": config["tier"],
                "level": level,
                "filename": filename,
                "path": f"/sprites/buildings/{filename}",
                "exists": exists,
                "size_bytes": size
            })
    total = len(sprites)
    generated = sum(1 for s in sprites if s["exists"])
    return {
        "total_expected": total,
        "total_generated": generated,
        "missing": total - generated,
        "sprites": sprites
    }
