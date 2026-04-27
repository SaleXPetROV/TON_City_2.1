"""
Business Production System
Handles resource production, warehouses, and patronage
"""
import uuid
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
import logging

logger = logging.getLogger(__name__)

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'ton-city-builder-secret-key-2025')
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

# ==================== CONSTANTS ====================

# Resource types produced by different businesses
BUSINESS_RESOURCES = {
    # Small businesses - Level 1
    "small_energy": {"name": "Энергия", "unit": "kWh", "base_production": 100},
    "small_water": {"name": "Вода", "unit": "л", "base_production": 500},
    "small_food": {"name": "Продукты", "unit": "кг", "base_production": 50},
    "small_materials": {"name": "Материалы", "unit": "ед", "base_production": 30},
    
    # Medium businesses - Level 2
    "medium_tech": {"name": "Технологии", "unit": "ед", "base_production": 20},
    "medium_transport": {"name": "Транспорт", "unit": "рейсов", "base_production": 15},
    "medium_services": {"name": "Услуги", "unit": "ед", "base_production": 40},
    
    # Large businesses - Level 3
    "large_finance": {"name": "Финансы", "unit": "TON", "base_production": 5},
    "large_real_estate": {"name": "Недвижимость", "unit": "м²", "base_production": 10},
    "large_manufacturing": {"name": "Производство", "unit": "ед", "base_production": 100},
}

# Warehouse capacities by business tier
WAREHOUSE_CAPACITY = {
    "small": {1: 500, 2: 1000, 3: 2000, 4: 4000, 5: 8000},  # Levels 1-5
    "medium": {1: 1000, 2: 2500, 3: 5000, 4: 10000, 5: 20000},
    "large": {1: 5000, 2: 12500, 3: 25000, 4: 50000, 5: 100000},
}

# Additional warehouse costs (TON)
WAREHOUSE_COSTS = {
    "small": {1: 5, 2: 10, 3: 20, 4: 40, 5: 80},
    "medium": {1: 15, 2: 30, 3: 60, 4: 120, 5: 240},
    "large": {1: 50, 2: 100, 3: 200, 4: 400, 5: 800},
}

MAX_ADDITIONAL_WAREHOUSES = 3

# ==================== PATRONAGE SYSTEM ====================

PATRONS = {
    "mayor": {
        "id": "mayor",
        "name": "Мэр города",
        "description": "Политическое покровительство. Даёт защиту от штрафов и доступ к городским контрактам.",
        "icon": "👔",
        "bonuses": {
            "tax_reduction": 0.15,  # 15% снижение налогов
            "city_contracts": True,  # Доступ к городским контрактам
            "penalty_immunity": 0.5,  # 50% шанс избежать штрафа
        },
        "requirement": "medium",  # Минимум средний бизнес
        "monthly_fee": 10,  # TON в месяц
    },
    "gang": {
        "id": "gang",
        "name": "Криминальный синдикат",
        "description": "Теневая крыша. Защита от рэкета и помощь с конкурентами.",
        "icon": "🔫",
        "bonuses": {
            "protection": True,  # Защита от рэкета
            "competitor_sabotage": 0.1,  # 10% шанс саботажа конкурентов
            "black_market_access": True,  # Доступ к чёрному рынку
        },
        "requirement": "small",
        "monthly_fee": 5,
    },
    "corporation": {
        "id": "corporation",
        "name": "Корпорация TON Industries",
        "description": "Корпоративное партнёрство. Технологии и эксклюзивные поставки.",
        "icon": "🏢",
        "bonuses": {
            "production_boost": 0.20,  # +20% к производству
            "tech_upgrades": True,  # Бесплатные технические улучшения
            "priority_supplies": True,  # Приоритетные поставки
        },
        "requirement": "small",
        "monthly_fee": 8,
    },
    "union": {
        "id": "union",
        "name": "Профсоюз работников",
        "description": "Народная поддержка. Лояльные работники и общественное одобрение.",
        "icon": "✊",
        "bonuses": {
            "worker_efficiency": 0.15,  # +15% эффективность работников
            "no_strikes": True,  # Нет забастовок
            "public_reputation": 0.25,  # +25% к репутации
        },
        "requirement": "small",
        "monthly_fee": 3,
    },
    "merchant_guild": {
        "id": "merchant_guild",
        "name": "Гильдия торговцев",
        "description": "Торговая сеть. Лучшие цены и расширенный рынок сбыта.",
        "icon": "🪙",
        "bonuses": {
            "sell_price_boost": 0.10,  # +10% к цене продажи
            "buy_price_reduction": 0.10,  # -10% к цене закупки
            "market_intel": True,  # Информация о рынке
        },
        "requirement": "small",
        "monthly_fee": 6,
    },
}


# ==================== REQUEST MODELS ====================

class SetPatronRequest(BaseModel):
    business_id: str
    patron_id: str

class BuyWarehouseRequest(BaseModel):
    business_id: str

class UpgradeWarehouseRequest(BaseModel):
    business_id: str
    warehouse_index: int  # 0 = main, 1-3 = additional


# ==================== HELPER FUNCTIONS ====================

def calculate_production(business: dict) -> dict:
    """Calculate current production based on building condition"""
    business_type = business.get("type", "small_energy")
    condition = business.get("condition", 100) / 100  # 0.0 to 1.0
    
    resource_info = BUSINESS_RESOURCES.get(business_type, BUSINESS_RESOURCES["small_energy"])
    base_production = resource_info["base_production"]
    
    # Get patron bonuses
    patron_id = business.get("patron_id")
    patron_bonus = 1.0
    if patron_id and patron_id in PATRONS:
        patron = PATRONS[patron_id]
        patron_bonus += patron["bonuses"].get("production_boost", 0)
        patron_bonus += patron["bonuses"].get("worker_efficiency", 0)
    
    # Calculate actual production
    actual_production = int(base_production * condition * patron_bonus)
    
    return {
        "resource_name": resource_info["name"],
        "resource_unit": resource_info["unit"],
        "base_production": base_production,
        "condition_multiplier": condition,
        "patron_bonus": patron_bonus - 1.0,
        "actual_production": actual_production,
        "status": "working" if condition > 0.1 else "stopped"
    }


def get_warehouse_capacity(business: dict) -> dict:
    """Get total warehouse capacity for a business"""
    # Determine business tier
    business_type = business.get("type", "small_energy")
    tier = "small"
    if business_type.startswith("medium_"):
        tier = "medium"
    elif business_type.startswith("large_"):
        tier = "large"
    
    # Main warehouse
    main_level = business.get("warehouse_level", 1)
    main_capacity = WAREHOUSE_CAPACITY[tier].get(main_level, WAREHOUSE_CAPACITY[tier][1])
    
    # Additional warehouses
    additional_warehouses = business.get("additional_warehouses", [])
    additional_capacity = 0
    for wh in additional_warehouses:
        wh_level = wh.get("level", 1)
        additional_capacity += WAREHOUSE_CAPACITY[tier].get(wh_level, WAREHOUSE_CAPACITY[tier][1])
    
    total_capacity = main_capacity + additional_capacity
    current_stored = business.get("stored_resources", 0)
    
    return {
        "tier": tier,
        "main_warehouse": {
            "level": main_level,
            "capacity": main_capacity,
        },
        "additional_warehouses": additional_warehouses,
        "total_capacity": total_capacity,
        "current_stored": current_stored,
        "free_space": max(0, total_capacity - current_stored),
        "fill_percentage": min(100, (current_stored / total_capacity * 100)) if total_capacity > 0 else 0
    }


def create_business_router(db):
    """Factory function to create business routes"""
    
    business_router = APIRouter(prefix="/api/businesses", tags=["businesses"])
    
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
    
    @business_router.get("/{business_id}/production")
    async def get_business_production(business_id: str, current_user: dict = Depends(get_current_user)):
        """Get production info for a business"""
        business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
        
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")
        
        if business.get("owner_id") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Это не ваш бизнес")
        
        production = calculate_production(business)
        warehouse = get_warehouse_capacity(business)
        
        # Get patron info
        patron_info = None
        if business.get("patron_id"):
            patron_info = PATRONS.get(business["patron_id"])
        
        return {
            "business_id": business_id,
            "name": business.get("name"),
            "type": business.get("type"),
            "condition": business.get("condition", 100),
            "production": production,
            "warehouse": warehouse,
            "patron": patron_info,
            "last_collection": business.get("last_collection"),
        }
    
    @business_router.get("/patrons")
    async def get_available_patrons():
        """Get list of all patrons"""
        return {"patrons": list(PATRONS.values())}
    
    @business_router.post("/set-patron")
    async def set_business_patron(request: SetPatronRequest, current_user: dict = Depends(get_current_user)):
        """Set patron for a business (required for small/medium businesses)"""
        business = await db.businesses.find_one({"id": request.business_id}, {"_id": 0})
        
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")
        
        if business.get("owner_id") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Это не ваш бизнес")
        
        if business.get("patron_id"):
            raise HTTPException(status_code=400, detail="Покровитель уже выбран")
        
        patron = PATRONS.get(request.patron_id)
        if not patron:
            raise HTTPException(status_code=400, detail="Неизвестный покровитель")
        
        # Check business tier requirement
        business_type = business.get("type", "")
        is_small = business_type.startswith("small_")
        is_medium = business_type.startswith("medium_")
        
        if patron["requirement"] == "medium" and is_small:
            raise HTTPException(status_code=400, detail="Этот покровитель требует минимум средний бизнес")
        
        # Deduct monthly fee
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        if user.get("balance_ton", 0) < patron["monthly_fee"]:
            raise HTTPException(status_code=400, detail="Недостаточно средств для оплаты покровительства")
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"balance_ton": -patron["monthly_fee"]}}
        )
        
        await db.businesses.update_one(
            {"id": request.business_id},
            {
                "$set": {
                    "patron_id": request.patron_id,
                    "patron_since": datetime.now(timezone.utc).isoformat(),
                    "patron_fee_paid_until": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log transaction
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "patron_fee",
            "amount": -patron["monthly_fee"],
            "details": {
                "business_id": request.business_id,
                "patron_id": request.patron_id,
                "patron_name": patron["name"]
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "status": "success",
            "patron": patron,
            "message": f"Покровитель '{patron['name']}' установлен"
        }
    
    @business_router.post("/buy-warehouse")
    async def buy_additional_warehouse(request: BuyWarehouseRequest, current_user: dict = Depends(get_current_user)):
        """Buy additional warehouse for a business"""
        business = await db.businesses.find_one({"id": request.business_id}, {"_id": 0})
        
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")
        
        if business.get("owner_id") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Это не ваш бизнес")
        
        additional_warehouses = business.get("additional_warehouses", [])
        if len(additional_warehouses) >= MAX_ADDITIONAL_WAREHOUSES:
            raise HTTPException(status_code=400, detail=f"Максимум {MAX_ADDITIONAL_WAREHOUSES} дополнительных складов")
        
        # Determine tier and cost
        business_type = business.get("type", "small_energy")
        tier = "small"
        if business_type.startswith("medium_"):
            tier = "medium"
        elif business_type.startswith("large_"):
            tier = "large"
        
        cost = WAREHOUSE_COSTS[tier][1]
        
        # Check balance
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        if user.get("balance_ton", 0) < cost:
            raise HTTPException(status_code=400, detail="Недостаточно средств")
        
        # Deduct cost
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"balance_ton": -cost}}
        )
        
        # Add warehouse
        new_warehouse = {
            "id": str(uuid.uuid4()),
            "level": 1,
            "purchased_at": datetime.now(timezone.utc).isoformat()
        }
        additional_warehouses.append(new_warehouse)
        
        await db.businesses.update_one(
            {"id": request.business_id},
            {"$set": {"additional_warehouses": additional_warehouses}}
        )
        
        # Log transaction
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "warehouse_purchase",
            "amount": -cost,
            "details": {
                "business_id": request.business_id,
                "warehouse_tier": tier,
                "warehouse_level": 1
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "status": "success",
            "cost": cost,
            "warehouse": new_warehouse,
            "message": "Дополнительный склад приобретён"
        }
    
    @business_router.post("/upgrade-warehouse")
    async def upgrade_warehouse(request: UpgradeWarehouseRequest, current_user: dict = Depends(get_current_user)):
        """Upgrade a warehouse level"""
        business = await db.businesses.find_one({"id": request.business_id}, {"_id": 0})
        
        if not business:
            raise HTTPException(status_code=404, detail="Бизнес не найден")
        
        if business.get("owner_id") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Это не ваш бизнес")
        
        # Determine tier
        business_type = business.get("type", "small_energy")
        tier = "small"
        if business_type.startswith("medium_"):
            tier = "medium"
        elif business_type.startswith("large_"):
            tier = "large"
        
        if request.warehouse_index == 0:
            # Main warehouse
            current_level = business.get("warehouse_level", 1)
            if current_level >= 5:
                raise HTTPException(status_code=400, detail="Максимальный уровень")
            
            new_level = current_level + 1
            cost = WAREHOUSE_COSTS[tier][new_level]
            
            # Check balance
            user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
            if user.get("balance_ton", 0) < cost:
                raise HTTPException(status_code=400, detail="Недостаточно средств")
            
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$inc": {"balance_ton": -cost}}
            )
            
            await db.businesses.update_one(
                {"id": request.business_id},
                {"$set": {"warehouse_level": new_level}}
            )
        else:
            # Additional warehouse
            additional_warehouses = business.get("additional_warehouses", [])
            idx = request.warehouse_index - 1
            
            if idx >= len(additional_warehouses):
                raise HTTPException(status_code=400, detail="Склад не найден")
            
            current_level = additional_warehouses[idx].get("level", 1)
            if current_level >= 5:
                raise HTTPException(status_code=400, detail="Максимальный уровень")
            
            new_level = current_level + 1
            cost = WAREHOUSE_COSTS[tier][new_level]
            
            user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
            if user.get("balance_ton", 0) < cost:
                raise HTTPException(status_code=400, detail="Недостаточно средств")
            
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$inc": {"balance_ton": -cost}}
            )
            
            additional_warehouses[idx]["level"] = new_level
            
            await db.businesses.update_one(
                {"id": request.business_id},
                {"$set": {"additional_warehouses": additional_warehouses}}
            )
        
        # Log transaction
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "warehouse_upgrade",
            "amount": -cost,
            "details": {
                "business_id": request.business_id,
                "warehouse_index": request.warehouse_index,
                "new_level": new_level
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "status": "success",
            "cost": cost,
            "new_level": new_level,
            "message": f"Склад улучшен до уровня {new_level}"
        }
    
    return business_router
