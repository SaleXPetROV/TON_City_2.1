"""Leaderboard endpoint. Split out of server.py (aggregate version)."""
from fastapi import APIRouter, Query


def create_leaderboard_router(db):
    router = APIRouter(prefix="/api", tags=["leaderboard"])

    @router.get("/leaderboard")
    async def get_leaderboard(
        sort_by: str = Query("balance", pattern="^(balance|income|businesses|plots)$"),
        limit: int = Query(20, ge=1, le=100),
    ):
        """Get top players ordered by chosen criterion.

        Returns both `players` (consumed by frontend) and `leaderboard`
        (kept for backward compatibility with previous API consumers).
        """
        sort_field_map = {
            "balance": "balance_ton",
            "income": "total_income",
            "businesses": "businesses_count",
            "plots": "plots_count",
        }
        sort_field = sort_field_map[sort_by]

        pipeline = [
            {
                "$project": {
                    "_id": 0,
                    "id": 1,
                    "username": 1,
                    "display_name": 1,
                    "avatar": 1,
                    "wallet_address": 1,
                    "level": 1,
                    "balance_ton": {"$ifNull": ["$balance_ton", 0]},
                    "total_income": {"$ifNull": ["$total_income", 0]},
                    "total_turnover": {"$ifNull": ["$total_turnover", 0]},
                    "plots_count": {"$size": {"$ifNull": ["$plots_owned", []]}},
                    "businesses_count": {
                        "$size": {"$ifNull": ["$businesses_owned", []]}
                    },
                }
            },
            {"$sort": {sort_field: -1}},
            {"$limit": limit},
        ]
        players = await db.users.aggregate(pipeline).to_list(limit)
        return {"players": players, "leaderboard": players, "sort_by": sort_by}

    return router
