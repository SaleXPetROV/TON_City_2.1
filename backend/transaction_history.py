"""
Transaction History System
Handles all user transactions: deposits, withdrawals, purchases, sales
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
import os
import logging

logger = logging.getLogger(__name__)

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'ton-city-builder-secret-key-2025')
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

# Transaction types
TRANSACTION_TYPES = {
    "deposit": {"name": "Пополнение", "icon": "💰", "color": "green", "sign": "+"},
    "withdrawal": {"name": "Вывод", "icon": "📤", "color": "red", "sign": "-"},
    "instant_withdrawal": {"name": "Мгновенный вывод", "icon": "⚡", "color": "red", "sign": "-"},
    "land_purchase": {"name": "Покупка земли", "icon": "🏞️", "color": "blue", "sign": "-"},
    "land_sale": {"name": "Продажа земли", "icon": "🏞️", "color": "green", "sign": "+"},
    "land_sale_listing": {"name": "Выставление земли на продажу", "icon": "🏷️", "color": "amber", "sign": ""},
    "plot_purchase": {"name": "Покупка участка", "icon": "🗺️", "color": "blue", "sign": "-"},
    "business_build": {"name": "Строительство бизнеса", "icon": "🏗️", "color": "purple", "sign": "-"},
    "business_upgrade": {"name": "Улучшение бизнеса", "icon": "⬆️", "color": "cyan", "sign": "-"},
    "business_purchase": {"name": "Покупка бизнеса", "icon": "🏢", "color": "blue", "sign": "-"},
    "resource_sale": {"name": "Продажа ресурсов", "icon": "📦", "color": "green", "sign": "+"},
    "resource_purchase": {"name": "Покупка ресурсов", "icon": "🛒", "color": "orange", "sign": "-"},
    "patron_fee": {"name": "Плата покровителю", "icon": "🤝", "color": "yellow", "sign": "-"},
    "warehouse_purchase": {"name": "Покупка склада", "icon": "🏭", "color": "blue", "sign": "-"},
    "warehouse_upgrade": {"name": "Улучшение склада", "icon": "📈", "color": "cyan", "sign": "-"},
    "tax": {"name": "Налог", "icon": "📋", "color": "red", "sign": "-", "hidden": True},
    "reward": {"name": "Награда", "icon": "🎁", "color": "gold", "sign": "+", "hidden": True},
    "trade": {"name": "Торговля", "icon": "💹", "color": "teal", "sign": "", "hidden": True},
    "repair": {"name": "Ремонт", "icon": "🔧", "color": "gray", "sign": "-"},
    "credit_taken": {"name": "Получение кредита", "icon": "🏦", "color": "blue", "sign": "+"},
    "credit_payment": {"name": "Погашение кредита", "icon": "💳", "color": "red", "sign": "-"},
    "referral_bonus": {"name": "Реферальный бонус", "icon": "👥", "color": "green", "sign": "+", "hidden": True},
    "income_collection": {"name": "Сбор дохода", "icon": "💵", "color": "green", "sign": "+", "hidden": True},
    "business_sale": {"name": "Продажа бизнеса", "icon": "🏢", "color": "green", "sign": "+"},
    "promo_activation": {"name": "Активация промокода", "icon": "🎫", "color": "green", "sign": "+"},
}


def create_history_router(db):
    """Factory function to create transaction history routes"""
    
    history_router = APIRouter(prefix="/api/history", tags=["history"])
    
    async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            identifier: str = payload.get("sub")
            if not identifier:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_doc = await db.users.find_one({
                "$or": [
                    {"wallet_address": identifier},
                    {"email": identifier},
                    {"username": identifier}
                ]
            })
            
            if not user_doc:
                raise HTTPException(status_code=404, detail="User not found")
            
            return {
                "id": user_doc.get("id", str(user_doc.get("_id"))),
                "wallet_address": user_doc.get("wallet_address"),
                "email": user_doc.get("email"),
                "username": user_doc.get("username")
            }
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    @history_router.get("/transactions")
    async def get_transactions(
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        type_filter: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        current_user: dict = Depends(get_current_user)
    ):
        """Get paginated transaction history"""
        query = {"user_id": current_user["id"]}
        
        # Type filter
        if type_filter and type_filter in TRANSACTION_TYPES:
            query["type"] = type_filter
        
        # Date filters
        if date_from:
            query["created_at"] = {"$gte": date_from}
        if date_to:
            if "created_at" in query:
                query["created_at"]["$lte"] = date_to
            else:
                query["created_at"] = {"$lte": date_to}
        
        # Get total count
        total = await db.transactions.count_documents(query)
        
        # Get transactions
        skip = (page - 1) * limit
        transactions = await db.transactions.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrich with type info
        for tx in transactions:
            tx_type = tx.get("type", "trade")
            # Map tx_type from database to proper type
            if tx_type == "withdrawal" or tx.get("tx_type") == "withdrawal":
                tx_type = "withdrawal"
            elif tx_type == "instant_withdrawal" or tx.get("tx_type") == "instant_withdrawal":
                tx_type = "instant_withdrawal"
            elif tx_type == "deposit":
                tx_type = "deposit"
            
            type_info = TRANSACTION_TYPES.get(tx_type, TRANSACTION_TYPES.get("trade", {"name": "Операция", "icon": "💱", "color": "gray", "sign": ""}))
            tx["type_name"] = type_info["name"]
            tx["type_icon"] = type_info["icon"]
            tx["type_color"] = type_info["color"]
            
            # Add human-readable status for withdrawals
            status = tx.get("status", "completed")
            if tx_type in ["withdrawal", "instant_withdrawal"]:
                if status == "pending":
                    tx["status_display"] = "В ожидании"
                    tx["status_color"] = "yellow"
                elif status == "processing":
                    tx["status_display"] = "Обрабатывается"
                    tx["status_color"] = "blue"
                elif status == "completed":
                    tx["status_display"] = "Одобрено"
                    tx["status_color"] = "green"
                elif status == "failed":
                    tx["status_display"] = "Ошибка"
                    tx["status_color"] = "red"
                elif status == "rejected":
                    tx["status_display"] = "Отклонено"
                    tx["status_color"] = "red"
                else:
                    tx["status_display"] = status
                    tx["status_color"] = "gray"
            else:
                tx["status_display"] = "Выполнено"
                tx["status_color"] = "green"
            
            # Ensure amount field exists (fallback to amount_ton)
            if "amount" not in tx:
                tx["amount"] = tx.get("amount_ton", 0)
            
            # Ensure correct sign for amount based on transaction type
            amount = tx.get("amount", 0)
            sign = type_info.get("sign", "")
            
            # Force negative for withdrawals, positive for deposits
            if tx_type in ["withdrawal", "instant_withdrawal"] and amount > 0:
                tx["amount"] = -abs(amount)
            elif tx_type == "deposit" and amount < 0:
                tx["amount"] = abs(amount)
        
        return {
            "transactions": transactions,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }
    
    @history_router.get("/transactions/{transaction_id}")
    async def get_transaction_details(transaction_id: str, current_user: dict = Depends(get_current_user)):
        """Get detailed transaction info"""
        tx = await db.transactions.find_one(
            {"id": transaction_id, "user_id": current_user["id"]},
            {"_id": 0}
        )
        
        if not tx:
            raise HTTPException(status_code=404, detail="Транзакция не найдена")
        
        tx_type = tx.get("type", "trade")
        type_info = TRANSACTION_TYPES.get(tx_type, TRANSACTION_TYPES["trade"])
        tx["type_name"] = type_info["name"]
        tx["type_icon"] = type_info["icon"]
        tx["type_color"] = type_info["color"]
        
        return tx
    
    @history_router.get("/summary")
    async def get_transaction_summary(current_user: dict = Depends(get_current_user)):
        """Get summary of all transactions by type"""
        pipeline = [
            {"$match": {"user_id": current_user["id"]}},
            {"$group": {
                "_id": "$type",
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$amount"}
            }},
            {"$sort": {"count": -1}}
        ]
        
        results = await db.transactions.aggregate(pipeline).to_list(50)
        
        summary = []
        for r in results:
            tx_type = r["_id"] or "trade"
            type_info = TRANSACTION_TYPES.get(tx_type, TRANSACTION_TYPES["trade"])
            summary.append({
                "type": tx_type,
                "type_name": type_info["name"],
                "type_icon": type_info["icon"],
                "count": r["count"],
                "total_amount": r["total_amount"]
            })
        
        # Get totals
        total_income = sum(s["total_amount"] for s in summary if s["total_amount"] > 0)
        total_expenses = sum(s["total_amount"] for s in summary if s["total_amount"] < 0)
        
        return {
            "summary": summary,
            "totals": {
                "income": total_income,
                "expenses": abs(total_expenses),
                "net": total_income + total_expenses
            }
        }
    
    @history_router.get("/types")
    async def get_transaction_types():
        """Get all available transaction types (excluding hidden ones)"""
        visible_types = {k: v for k, v in TRANSACTION_TYPES.items() if not v.get("hidden")}
        return {"types": visible_types}
    
    return history_router


async def log_transaction(db, user_id: str, tx_type: str, amount: float, details: Dict[str, Any] = None):
    """Helper function to log a transaction"""
    tx = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": tx_type,
        "amount": amount,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(tx)
    return tx
