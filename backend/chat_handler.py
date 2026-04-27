"""
TON City Builder - Chat System
Global chat, city chat, and private messages
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import json
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Router
chat_router = APIRouter(prefix="/chat", tags=["Chat"])
security = HTTPBearer(auto_error=False)

# MongoDB connection (will be set from main server)
db = None

def set_db(database):
    global db
    db = database


# ==================== MODELS ====================

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    chat_type: str = "global"  # global, city, private
    city_id: Optional[str] = None
    recipient_id: Optional[str] = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    chat_type: str
    city_id: Optional[str] = None
    sender_id: str
    sender_username: str
    sender_avatar: Optional[str] = None
    recipient_id: Optional[str] = None
    recipient_username: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_read: bool = False


# ==================== WEBSOCKET CONNECTIONS ====================

class ConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # city_id -> set of user_ids
        self.city_subscribers: Dict[str, set] = {}
        # All global chat subscribers
        self.global_subscribers: set = set()
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.global_subscribers.add(user_id)
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        self.global_subscribers.discard(user_id)
        # Remove from all city subscriptions
        for city_subs in self.city_subscribers.values():
            city_subs.discard(user_id)
    
    def subscribe_to_city(self, user_id: str, city_id: str):
        if city_id not in self.city_subscribers:
            self.city_subscribers[city_id] = set()
        self.city_subscribers[city_id].add(user_id)
    
    def unsubscribe_from_city(self, user_id: str, city_id: str):
        if city_id in self.city_subscribers:
            self.city_subscribers[city_id].discard(user_id)
    
    async def broadcast_global(self, message: dict):
        """Send message to all connected users"""
        for user_id in self.global_subscribers:
            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_json(message)
                except:
                    pass
    
    async def broadcast_city(self, city_id: str, message: dict):
        """Send message to users subscribed to a city"""
        if city_id not in self.city_subscribers:
            return
        for user_id in self.city_subscribers[city_id]:
            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_json(message)
                except:
                    pass
    
    async def send_private(self, user_id: str, message: dict):
        """Send private message to specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                pass


manager = ConnectionManager()


# ==================== AUTH HELPER ====================

async def get_current_user_from_token(token: str):
    """Get user from JWT token"""
    from jose import jwt, JWTError
    SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'ton-city-builder-secret-key-2025')
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        identifier = payload.get("sub")
        if not identifier:
            return None
        
        # Search by wallet_address, email, username (same as main server)
        user = await db.users.find_one({
            "$or": [
                {"wallet_address": identifier},
                {"email": identifier},
                {"username": identifier},
                {"id": identifier}
            ]
        }, {"_id": 0, "hashed_password": 0})
        
        return user
    except JWTError:
        return None


# ==================== REST ENDPOINTS ====================

@chat_router.get("/messages/global")
async def get_global_messages(limit: int = 50, before: str = None):
    """Get global chat messages"""
    query = {"chat_type": "global"}
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.chat_messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"messages": list(reversed(messages)), "total": len(messages)}


@chat_router.get("/messages/city/{city_id}")
async def get_city_messages(city_id: str, limit: int = 50, before: str = None):
    """Get city chat messages"""
    query = {"chat_type": "city", "city_id": city_id}
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.chat_messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"messages": list(reversed(messages)), "total": len(messages)}


@chat_router.get("/messages/private/{user_id}")
async def get_private_messages(
    user_id: str,
    limit: int = 50,
    credentials = Depends(security)
):
    """Get private messages with specific user"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    current_user = await get_current_user_from_token(credentials.credentials)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    my_id = current_user.get("id")
    
    query = {
        "chat_type": "private",
        "$or": [
            {"sender_id": my_id, "recipient_id": user_id},
            {"sender_id": user_id, "recipient_id": my_id}
        ]
    }
    
    messages = await db.chat_messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark as read
    await db.chat_messages.update_many(
        {"recipient_id": my_id, "sender_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"messages": list(reversed(messages)), "total": len(messages)}


@chat_router.get("/conversations")
async def get_conversations(credentials = Depends(security)):
    """Get list of private conversations"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    current_user = await get_current_user_from_token(credentials.credentials)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    my_id = current_user.get("id")
    
    # Get unique conversation partners
    pipeline = [
        {"$match": {
            "chat_type": "private",
            "$or": [{"sender_id": my_id}, {"recipient_id": my_id}]
        }},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {
                "$cond": [
                    {"$eq": ["$sender_id", my_id]},
                    "$recipient_id",
                    "$sender_id"
                ]
            },
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$eq": ["$recipient_id", my_id]},
                            {"$eq": ["$is_read", False]}
                        ]},
                        1, 0
                    ]
                }
            }
        }}
    ]
    
    result = await db.chat_messages.aggregate(pipeline).to_list(50)
    
    conversations = []
    for r in result:
        partner_id = r["_id"]
        partner = await db.users.find_one(
            {"id": partner_id},
            {"_id": 0, "username": 1, "avatar": 1}
        )
        conversations.append({
            "partner_id": partner_id,
            "partner_username": partner.get("username") if partner else "Unknown",
            "partner_avatar": partner.get("avatar") if partner else None,
            "last_message": r["last_message"],
            "unread_count": r["unread_count"]
        })
    
    return {"conversations": conversations}


@chat_router.post("/send")
async def send_message(data: SendMessageRequest, credentials = Depends(security)):
    """Send a chat message"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    current_user = await get_current_user_from_token(credentials.credentials)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate chat type
    if data.chat_type == "city" and not data.city_id:
        raise HTTPException(status_code=400, detail="city_id required for city chat")
    
    if data.chat_type == "private" and not data.recipient_id:
        raise HTTPException(status_code=400, detail="recipient_id required for private chat")
    
    # Create message
    message = {
        "id": str(uuid.uuid4()),
        "content": data.content,
        "chat_type": data.chat_type,
        "city_id": data.city_id,
        "sender_id": current_user.get("id"),
        "sender_username": current_user.get("username", "Anonymous"),
        "sender_avatar": current_user.get("avatar"),
        "recipient_id": data.recipient_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    
    # Get recipient username for private messages
    if data.chat_type == "private" and data.recipient_id:
        recipient = await db.users.find_one({"id": data.recipient_id}, {"username": 1})
        message["recipient_username"] = recipient.get("username") if recipient else None
    
    # Save to database
    await db.chat_messages.insert_one(message.copy())
    
    # Broadcast via WebSocket
    ws_message = {
        "type": "new_message",
        "message": message
    }
    
    if data.chat_type == "global":
        await manager.broadcast_global(ws_message)
    elif data.chat_type == "city":
        await manager.broadcast_city(data.city_id, ws_message)
    elif data.chat_type == "private":
        # Send to recipient
        await manager.send_private(data.recipient_id, ws_message)
        # Send back to sender (confirmation)
        await manager.send_private(current_user.get("id"), ws_message)
    
    return {"status": "sent", "message": message}


@chat_router.get("/unread-count")
async def get_unread_count(credentials = Depends(security)):
    """Get total unread message count"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    current_user = await get_current_user_from_token(credentials.credentials)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    count = await db.chat_messages.count_documents({
        "recipient_id": current_user.get("id"),
        "is_read": False
    })
    
    return {"unread_count": count}


# ==================== WEBSOCKET ENDPOINT ====================

async def chat_websocket_handler(websocket: WebSocket, token: str):
    """WebSocket handler for real-time chat"""
    user = await get_current_user_from_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = user.get("id")
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle subscription to city chat
            if data.get("action") == "subscribe_city":
                city_id = data.get("city_id")
                if city_id:
                    manager.subscribe_to_city(user_id, city_id)
                    await websocket.send_json({
                        "type": "subscribed",
                        "city_id": city_id
                    })
            
            elif data.get("action") == "unsubscribe_city":
                city_id = data.get("city_id")
                if city_id:
                    manager.unsubscribe_from_city(user_id, city_id)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "city_id": city_id
                    })
            
            # Ping/pong for keepalive
            elif data.get("action") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        manager.disconnect(user_id)
