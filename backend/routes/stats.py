"""Game-wide statistics endpoint.

Split out of server.py (was lines 6901-6948).
"""
from fastapi import APIRouter


def create_stats_router(db):
    router = APIRouter(prefix="/api", tags=["stats"])

    @router.get("/stats")
    async def get_game_stats():
        """Get overall game statistics (combined old collections + TON Island)."""
        owned_plots_old = await db.plots.count_documents({"is_available": False})
        total_businesses_old = await db.businesses.count_documents({})

        island = await db.islands.find_one({"id": "ton_island"})
        owned_plots_island = 0
        businesses_island = 0
        if island and 'cells' in island:
            for cell in island['cells']:
                if cell.get('owner'):
                    owned_plots_island += 1
                if cell.get('business'):
                    businesses_island += 1

        owned_plots = owned_plots_old + owned_plots_island
        total_businesses = total_businesses_old + businesses_island
        total_users = await db.users.count_documents({})

        pipeline = [
            {"$match": {"balance_ton": {"$gt": 0}}},
            {"$group": {"_id": None, "total": {"$sum": "$balance_ton"}}},
        ]
        balance_result = await db.users.aggregate(pipeline).to_list(1)
        total_balance = balance_result[0]["total"] if balance_result else 0

        admin_stats = await db.admin_stats.find_one({"type": "treasury"}, {"_id": 0})
        total_plots = max(10000, len(island.get('cells', [])) if island else 0)

        return {
            "total_plots": total_plots,
            "owned_plots": owned_plots,
            "available_plots": total_plots - owned_plots,
            "total_businesses": total_businesses,
            "total_players": total_users,
            "total_volume_ton": max(0, round(total_balance, 2)),
            "treasury": admin_stats or {},
        }

    return router
