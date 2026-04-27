"""Leaderboard endpoint. Split out of server.py (aggregate version)."""
from fastapi import APIRouter


def create_leaderboard_router(db):
    router = APIRouter(prefix="/api", tags=["leaderboard"])

    @router.get("/leaderboard")
    async def get_leaderboard():
        """Get top players by total income."""
        pipeline = [
            {"$sort": {"total_income": -1}},
            {"$limit": 20},
            {"$project": {
                "_id": 0,
                "wallet_address": 1,
                "display_name": 1,
                "level": 1,
                "total_income": 1,
                "total_turnover": 1,
                "plots_count": {"$size": {"$ifNull": ["$plots_owned", []]}},
                "businesses_count": {"$size": {"$ifNull": ["$businesses_owned", []]}},
            }},
        ]
        leaders = await db.users.aggregate(pipeline).to_list(20)
        return {"leaderboard": leaders}

    return router
