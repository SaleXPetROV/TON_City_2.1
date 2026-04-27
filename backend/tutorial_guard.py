"""
Tutorial Guard Middleware
=========================
Permissive guard: while tutorial is active, only BLOCKS specific destructive
writes (withdraw, take loan, buy from real players, send chat message).
Every other request (reads, navigation, business catalog, security status,
etc.) is allowed to pass through so the app works normally.

Read-only, non-mutating.
"""
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from jose import jwt, JWTError

from tutorial_steps import is_write_blocked_during_tutorial

logger = logging.getLogger(__name__)


class TutorialGuardMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, db, secret_key: str, algorithm: str = "HS256"):
        super().__init__(app)
        self.db = db
        self.secret_key = secret_key
        self.algorithm = algorithm

    async def dispatch(self, request, call_next):
        path = request.url.path
        method = request.method

        if not path.startswith("/api/"):
            return await call_next(request)

        # Fast path: not a potentially blocked write → pass through
        if not is_write_blocked_during_tutorial(method, path):
            return await call_next(request)

        # Only now do we need to authenticate + check tutorial state
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth_header or not auth_header.lower().startswith("bearer "):
            return await call_next(request)

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            identifier = payload.get("sub")
        except JWTError:
            return await call_next(request)

        if not identifier:
            return await call_next(request)

        try:
            user_doc = await self.db.users.find_one(
                {
                    "$or": [
                        {"wallet_address": identifier},
                        {"email": identifier},
                        {"username": identifier},
                    ]
                },
                {"_id": 0, "tutorial_active": 1},
            )
        except Exception as e:
            logger.warning(f"[tutorial_guard] DB error: {e}")
            return await call_next(request)

        if not user_doc or not user_doc.get("tutorial_active"):
            return await call_next(request)

        # Tutorial is active AND this is a blocked write → deny
        return JSONResponse(
            status_code=403,
            content={
                "detail": "tutorial_action_blocked",
                "message": "This action is disabled during the tutorial. Finish the tutorial to use it.",
            },
        )
