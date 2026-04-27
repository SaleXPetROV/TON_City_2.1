"""
WebSocket Connection Manager
"""
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)
    
    async def send_personal(self, message: dict, user_id: str):
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception:
                pass
    
    async def broadcast(self, message: dict):
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(user_id)


# Global manager instance
manager = ConnectionManager()

# Online users tracking
online_users = set()
last_activity = {}
