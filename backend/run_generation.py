
import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sprite_generator import generate_all_sprites

async def main():
    print("Starting sprite generation...")
    try:
        results = await generate_all_sprites()
        print("\nGeneration Complete!")
        print(f"Success: {len(results['success'])}")
        print(f"Skipped: {len(results['skipped'])}")
        print(f"Failed: {len(results['failed'])}")
        
        if results['failed']:
            print("\nFailures:")
            for fail in results['failed']:
                print(f"- {fail['file']}: {fail['error']}")
                
    except Exception as e:
        print(f"Fatal error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
