"""Health / root endpoints.

Split out of server.py (was lines 10864-10872).
"""
from fastapi import APIRouter


def create_health_router():
    router = APIRouter(prefix="/api", tags=["health"])

    @router.get("/")
    async def root():
        return {"message": "TON City Builder API", "version": "2.0.0", "websocket": True}

    @router.get("/health")
    async def health():
        return {"status": "healthy", "websocket": True}

    return router
