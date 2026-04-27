"""
TON City Builder API - Main Entry Point
=======================================

This is the main entry point for the application.
All routes are organized in separate modules under routes/ directory.
Core functionality is in core/ directory.
"""

from fastapi import FastAPI, WebSocket
from starlette.middleware.cors import CORSMiddleware
import os
import logging

# Import core modules
from core.database import db, client
from core.websocket import manager

# Import TON integration and background tasks
from ton_integration import init_ton_client, close_ton_client
from background_tasks import init_scheduler, start_scheduler, shutdown_scheduler
from payment_monitor import init_payment_monitor, stop_payment_monitor

# Import all routers from the legacy server.py (will be gradually moved to routes/)
# For now, we import from server.py to maintain compatibility
from server import (
    app, api_router, admin_router, public_router,
    auth_router, chat_router, security_router,
    business_router, history_router,
    set_chat_db, chat_websocket_handler
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Note: The actual app instance and routes are defined in server.py
# This file serves as documentation and future entry point
# when full migration to modular structure is complete

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
