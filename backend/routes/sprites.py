"""Sprite generation endpoints (admin-only generation + public info).

Split out of server.py (was lines 6951-6996).
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks

from core.dependencies import get_current_admin
from core.models import User
from sprite_generator import (
    BUILDING_BASE_PROMPTS,
    generate_building_sprite,
    get_all_sprites_info,
    generate_all_sprites,
)

logger = logging.getLogger(__name__)


def create_sprites_router():
    router = APIRouter(prefix="/api", tags=["sprites"])

    @router.get("/sprites/info")
    async def get_sprites_info():
        """Get info about available building sprites (21 types × 10 levels = 210 total)."""
        return get_all_sprites_info()

    @router.post("/sprites/generate/{building_type}/{level}")
    async def generate_sprite(
        building_type: str,
        level: int = 1,
        admin: User = Depends(get_current_admin),
    ):
        """Generate a single sprite (admin only)."""
        if building_type not in BUILDING_BASE_PROMPTS:
            raise HTTPException(status_code=400, detail=f"Unknown building type: {building_type}")
        if level < 1 or level > 10:
            raise HTTPException(status_code=400, detail="Level must be between 1 and 10")
        try:
            filename = f"{building_type}_lvl{level}.png"
            save_path = f"/app/frontend/public/sprites/buildings/{filename}"
            image_bytes = await generate_building_sprite(building_type, level, save_path)
            return {
                "status": "success",
                "building_type": building_type,
                "level": level,
                "path": f"/sprites/buildings/{filename}",
                "size_bytes": len(image_bytes),
            }
        except Exception as e:
            logger.error(f"Failed to generate sprite: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/sprites/generate-all")
    async def generate_all_sprites_endpoint(
        background_tasks: BackgroundTasks,
        admin: User = Depends(get_current_admin),
    ):
        """Generate all 210 building sprites in the background (admin only)."""
        background_tasks.add_task(generate_all_sprites)
        return {
            "status": "started",
            "total_sprites": len(BUILDING_BASE_PROMPTS) * 10,
            "message": "Generating 210 sprites (21 types × 10 levels). Check /api/sprites/info for progress.",
        }

    return router
