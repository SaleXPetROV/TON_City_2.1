"""
Regenerate all 210 building sprites with proper visual hierarchy.
Run in background: python3 regenerate_sprites.py &
"""
import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from sprite_generator import BUILDING_BASE_PROMPTS, generate_building_sprite

OUTPUT_DIR = "/app/frontend/public/sprites/buildings"

async def main():
    total = len(BUILDING_BASE_PROMPTS) * 10
    current = 0
    success = 0
    failed = 0
    start = time.time()
    
    print(f"=== Starting regeneration of {total} sprites ===")
    print(f"Output: {OUTPUT_DIR}")
    
    for building_type in BUILDING_BASE_PROMPTS.keys():
        for level in range(1, 11):
            current += 1
            filename = f"{building_type}_lvl{level}.png"
            save_path = f"{OUTPUT_DIR}/{filename}"
            
            try:
                print(f"[{current}/{total}] Generating {filename}...")
                await generate_building_sprite(building_type, level, save_path)
                success += 1
                print(f"[{current}/{total}] OK {filename}")
                
                # Rate limit delay
                await asyncio.sleep(1.5)
                
            except Exception as e:
                failed += 1
                print(f"[{current}/{total}] FAIL {filename}: {e}")
                await asyncio.sleep(3)
    
    elapsed = time.time() - start
    print(f"\n=== Done in {elapsed:.0f}s ===")
    print(f"Success: {success}, Failed: {failed}, Total: {total}")

if __name__ == "__main__":
    asyncio.run(main())
