"""Wallet authentication + user plot/business accessors.

Split from server.py (AUTH ROUTES section, ~290 lines).
"""
from datetime import datetime, timezone
import logging
import os

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from core.dependencies import get_current_user
from core.models import User
from core.helpers import (
    get_user_identifiers as _helper_gui,
    to_raw,
    to_user_friendly,
    resolve_business_config,
)
from business_config import BUSINESSES

logger = logging.getLogger(__name__)


class WalletVerifyRequest(BaseModel):
    address: str
    proof: Optional[Dict[str, Any]] = None
    language: str = "en"
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


def create_auth_wallet_router(db):
    router = APIRouter(prefix="/api", tags=["auth-wallet"])

    async def get_user_identifiers(current_user):
        return await _helper_gui(db, current_user)


    @router.post("/auth/verify-wallet")
    async def verify_wallet(request: WalletVerifyRequest):
        """Verify wallet connection with DEBUG logging"""
        try:
            # S6: sanitized logging — no raw password/email echoes
            logger.info(f"[AUTH] verify-wallet address={request.address} username={request.username} email={'***' if request.email else None}")

            raw_input = (request.address or "").strip()
            if not raw_input:
                raise HTTPException(status_code=400, detail="Wallet address required")

            # Нормализация (используем твои функции из auth_handler или tonsdk)
            wallet_uf = to_user_friendly(raw_input) or (raw_input if raw_input.startswith("0:") else None)
            raw_addr = to_raw(raw_input) or (to_raw(wallet_uf) if wallet_uf else None)

            if not wallet_uf or not raw_addr:
                print(f"❌ Ошибка нормализации адреса: {raw_input}")
                raise HTTPException(status_code=400, detail="Invalid TON address format")

            wallet_address = wallet_uf

            # Поиск пользователя
            user_doc = await db.users.find_one({
                "$or": [{"wallet_address": wallet_address}, {"raw_address": raw_addr}]
            })

            if not user_doc:
                print("ℹ️ Пользователь не найден в БД. Попытка регистрации...")

                if not request.username:
                    print("⚠️ Регистрация прервана: не указан username")
                    return {
                        "status": "need_username",
                        "message": "Username required for registration",
                        "wallet_address": wallet_address
                    }

                # Проверка уникальности username
                existing_username = await db.users.find_one({"username": request.username})
                if existing_username:
                    print(f"❌ Ошибка: Username {request.username} уже занят")
                    raise HTTPException(status_code=400, detail="Имя пользователя уже занято")

                # Проверка уникальности Email (если он прислан)
                if request.email:
                    existing_email = await db.users.find_one({"email": request.email})
                    if existing_email:
                        print(f"❌ Ошибка: Email {request.email} уже занят")
                        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

                # Импортируем функцию генерации аватара
                from auth_handler import generate_avatar_from_initials, pwd_context

                # Генерируем аватар из username
                avatar = generate_avatar_from_initials(request.username)

                # Хешируем пароль если он есть
                hashed_password = None
                if request.password:
                    hashed_password = pwd_context.hash(request.password)

                # Формируем объект для записи
                import uuid
                new_user = {
                    "id": str(uuid.uuid4()),
                    "wallet_address": wallet_address,
                    "raw_address": raw_addr,
                    "wallet_linked_at": datetime.now(timezone.utc).isoformat(),  # Track when wallet was linked
                    "username": request.username,
                    "display_name": request.username,
                    "email": request.email,
                    "hashed_password": hashed_password,
                    "avatar": avatar,
                    "language": request.language or "en",
                    "is_admin": False,
                    "balance_ton": 0.0,
                    "level": 1,
                    "xp": 0,
                    "total_turnover": 0,
                    "total_income": 0.0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_login": datetime.now(timezone.utc).isoformat(),
                    "plots_owned": [],
                    "businesses_owned": []
                }

                # --- ЛОГ ПЕРЕД ЗАПИСЬЮ В БД ---
                print("📝 ПОПЫТКА ЗАПИСИ В MONGODB:")
                print(json.dumps({**new_user, "hashed_password": "***" if hashed_password else None}, indent=2, ensure_ascii=False))

                try:
                    result = await db.users.insert_one(new_user)
                    print(f"✅ УСПЕШНО ЗАПИСАНО. ID: {result.inserted_id}")
                    user_doc = new_user
                except Exception as db_err:
                    print(f"❌ КРИТИЧЕСКАЯ ОШИБКА MONGODB: {db_err}")
                    raise HTTPException(status_code=500, detail=f"Database error: {str(db_err)}")
            else:
                print(f"✅ Пользователь найден: {user_doc.get('username')}. Обновляем вход.")
                update_data = {
                    "last_login": datetime.now(timezone.utc).isoformat(), 
                    "language": request.language
                }
                # Обновляем email/pass только если они присланы и их нет в базе
                if request.email and not user_doc.get("email"):
                    update_data["email"] = request.email
                if request.password and not user_doc.get("password"):
                    update_data["password"] = request.password

                await db.users.update_one({"_id": user_doc["_id"]}, {"$set": update_data})
                user_doc.update(update_data)

            # Создаем токен
            from auth_handler import create_token
            token = create_token(data={"sub": wallet_address})
            print(f"🎫 JWT токен сгенерирован для: {wallet_address}")

            return {
                "status": "ok",
                "token": token,
                "user": {
                    "id": user_doc.get("id", str(user_doc.get("_id"))),
                    "username": user_doc.get("username"),
                    "display_name": user_doc.get("display_name") or user_doc.get("username"),
                    "wallet_address": wallet_address,
                    "email": user_doc.get("email"),
                    "avatar": user_doc.get("avatar"),
                    "level": user_doc.get("level", 1),
                    "is_admin": user_doc.get("is_admin", False)
                }
            }

        except Exception as e:
            print(f"💥 ОШИБКА В РОУТЕ verify_wallet: {str(e)}")
            logger.error("Full traceback: ", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/auth/me")
    async def get_current_user_info(current_user: User = Depends(get_current_user)):
        """Get current user info"""
        # Ищем пользователя по разным полям
        user_doc = None
        if current_user.wallet_address:
            user_doc = await db.users.find_one({"wallet_address": current_user.wallet_address})
        elif current_user.email:
            user_doc = await db.users.find_one({"email": current_user.email})
        elif current_user.username:
            user_doc = await db.users.find_one({"username": current_user.username})

        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        raw = user_doc.get("raw_address") or to_raw(user_doc.get("wallet_address") or "")
        display = user_doc.get("wallet_address")

        # Определяем тип аутентификации
        has_password = bool(user_doc.get("hashed_password"))
        has_google = bool(user_doc.get("google_id"))
        has_wallet = bool(user_doc.get("wallet_address"))

        if has_google:
            auth_type = "google"
        elif has_wallet and not has_password:
            auth_type = "wallet"
        else:
            auth_type = "email"

        # Check 2FA status
        has_2fa = bool(user_doc.get("is_2fa_enabled", False))
        has_two_factor_secret = bool(user_doc.get("two_factor_secret"))
        has_passkeys = bool(user_doc.get("passkeys") and len(user_doc.get("passkeys", [])) > 0)

        return {
            "id": user_doc.get("id", str(user_doc.get("_id"))),
            "username": user_doc.get("username"),
            "display_name": user_doc.get("display_name") or user_doc.get("username"),
            "email": user_doc.get("email"),
            "avatar": user_doc.get("avatar"),
            "wallet_address": user_doc.get("wallet_address"),
            "wallet_address_raw": raw,
            "wallet_address_display": display,
            "language": user_doc.get("language", "en"),
            "level": user_doc.get("level", 1),
            "xp": user_doc.get("xp", 0),
            "balance_ton": user_doc.get("balance_ton", 0.0),
            "total_turnover": user_doc.get("total_turnover", 0.0),
            "total_income": user_doc.get("total_income", 0.0),
            "plots_owned": user_doc.get("plots_owned", []),
            "businesses_owned": user_doc.get("businesses_owned", []),
            "is_admin": user_doc.get("is_admin", False),
            "is_bank": user_doc.get("is_bank", False),
            "is_2fa_enabled": has_2fa or has_two_factor_secret,
            "has_passkeys": has_passkeys,
            "max_plots": 999 if user_doc.get("is_admin", False) or user_doc.get("is_bank", False) or user_doc.get("role") in ["ADMIN", "BANK"] else 3,
            "auth_type": auth_type
        }

    @router.get("/users/me/plots")
    async def get_my_plots(current_user: User = Depends(get_current_user)):
        """Получить все участки пользователя"""
        ui = await get_user_identifiers(current_user)
        if not ui["user"]:
            return {"plots": [], "total": 0}

        user_ids = ui["ids"]
        plots = []

        # Ищем участки в старой коллекции plots
        old_plots = await db.plots.find({
            "$or": [{"owner": uid} for uid in user_ids]
        }, {"_id": 0}).to_list(100)

        for plot in old_plots:
            city = await db.cities.find_one({"id": plot.get("city_id")}, {"_id": 0, "name": 1})
            plot["city_name"] = city.get("name", "TON Island") if city else "TON Island"

            # Add business info if exists
            if plot.get("business_id"):
                business = await db.businesses.find_one({"id": plot["business_id"]}, {"_id": 0})
                if business:
                    biz_config = resolve_business_config(business.get("business_type"))
                    plot["business_type"] = business.get("business_type")
                    plot["business_name"] = biz_config.get("name", business.get("business_type"))
                    plot["business_cost"] = business.get("base_cost_ton", biz_config.get("base_cost_ton", 0))

            plots.append(plot)

        # Ищем участки на TON Island
        island_plots = await db.plots.find({
            "island_id": "ton_island",
            "$or": [{"owner": uid} for uid in user_ids]
        }, {"_id": 0}).to_list(100)

        for plot in island_plots:
            zone_name = plot.get('zone', 'outer')
            plot["city_name"] = "TON Island"
            plot["island_id"] = "ton_island"

            # Add business info - check both business_id and inline business
            if plot.get("business_id"):
                business = await db.businesses.find_one({"id": plot["business_id"]}, {"_id": 0})
                if business:
                    biz_config = resolve_business_config(business.get("business_type"))
                    plot["business_type"] = business.get("business_type")
                    plot["business_name"] = biz_config.get("name", business.get("business_type"))
                    plot["business_cost"] = business.get("base_cost_ton", biz_config.get("base_cost_ton", 0))
            elif plot.get("business"):
                # Inline business data (from pre-assigned purchase)
                biz = plot["business"]
                plot["business_type"] = biz.get("type")
                plot["business_name"] = biz.get("name")
                plot["business_cost"] = plot.get("price_ton", 0)
                plot["business_icon"] = biz.get("icon")
                plot["business_tier"] = biz.get("tier", 1)
                plot["business_level"] = biz.get("level", 1)
                plot["monthly_income_ton"] = biz.get("monthly_income_ton", 0)
                plot["monthly_income_city"] = biz.get("monthly_income_city", 0)

            # Check if already in plots list
            if not any(p.get("id") == plot.get("id") for p in plots):
                plots.append(plot)

        return {"plots": plots, "total": len(plots)}

    @router.get("/users/me/businesses")
    async def get_my_businesses(current_user: User = Depends(get_current_user)):
        """Получить все бизнесы пользователя"""
        # Search by both user.id and wallet_address for compatibility
        query = {"$or": [
            {"owner": current_user.id},
            {"owner": current_user.wallet_address}
        ]} if current_user.wallet_address else {"owner": current_user.id}

        businesses = await db.businesses.find(query, {"_id": 0}).to_list(100)

        # Добавляем информацию о типе бизнеса
        for biz in businesses:
            bt = BUSINESS_TYPES.get(biz.get("business_type"), {})
            biz["produces"] = bt.get("produces")
            biz["consumes"] = bt.get("consumes", [])

        return {"businesses": businesses, "total": len(businesses)}



    return router
