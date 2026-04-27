"""Notifications endpoints.

Split out of server.py (was lines 1093-1114). Also exposes an in-app banner
aggregation for low-durability businesses (<20%) so the frontend can show a
warning banner without the user being on Telegram.
"""
from fastapi import APIRouter, Depends

from core.dependencies import get_current_user
from core.models import User
from core.helpers import get_user_identifiers as _helper_gui


def create_notifications_router(db):
    router = APIRouter(prefix="/api", tags=["notifications"])

    async def get_user_identifiers(current_user):
        return await _helper_gui(db, current_user)

    @router.get("/notifications")
    async def get_user_notifications(current_user: User = Depends(get_current_user)):
        ui = await get_user_identifiers(current_user)
        if not ui["user"]:
            return {"notifications": []}
        user_id = ui["user"].get("id", "")
        notifications = await db.notifications.find(
            {"user_id": user_id, "read": False},
            {"_id": 0},
        ).sort("created_at", -1).to_list(20)
        return {"notifications": notifications}

    @router.post("/notifications/{notif_id}/read")
    async def mark_notification_read(notif_id: str, current_user: User = Depends(get_current_user)):
        await db.notifications.update_one({"id": notif_id}, {"$set": {"read": True}})
        return {"status": "ok"}

    @router.get("/notifications/low-durability")
    async def get_low_durability_banners(current_user: User = Depends(get_current_user)):
        """Return user's businesses with durability < 20% for in-app banner.

        Used by the frontend to show a persistent top banner when any of the
        user's businesses is about to stop — complements Telegram warnings.
        """
        ui = await get_user_identifiers(current_user)
        if not ui["user"]:
            return {"alerts": []}

        user_ids = list(ui["ids"])
        or_conditions = [{"owner": uid} for uid in user_ids]
        or_conditions.extend([{"owner_wallet": uid} for uid in user_ids])

        cursor = db.businesses.find(
            {
                "$or": or_conditions,
                "durability": {"$lt": 20},
            },
            {"_id": 0, "id": 1, "business_type": 1, "level": 1, "durability": 1, "name": 1},
        ).limit(20)

        alerts = []
        async for biz in cursor:
            alerts.append({
                "business_id": biz.get("id"),
                "business_type": biz.get("business_type"),
                "level": biz.get("level", 1),
                "durability": round(float(biz.get("durability", 0) or 0), 1),
                "severity": "critical" if (biz.get("durability", 0) or 0) < 10 else "warning",
            })

        return {"alerts": alerts, "count": len(alerts)}

    return router
