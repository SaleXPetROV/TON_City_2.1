"""
Telegram Notification Service for TON City
Sends notifications about business status, resources, etc.
"""

import os
import asyncio
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

async def send_telegram_message(chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
    """Send a message via Telegram bot"""
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        logger.warning("Telegram bot token or chat_id not configured")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TELEGRAM_API_URL}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": parse_mode
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                logger.info(f"Telegram message sent to {chat_id}")
                return True
            else:
                logger.error(f"Failed to send Telegram message: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Error sending Telegram message: {e}")
        return False


# ==================== BUSINESS NOTIFICATIONS ====================

async def notify_low_durability(chat_id: str, business_name: str, durability: float):
    """Notify user when business durability drops below 50%"""
    text = f"""⚠️ <b>Внимание! Износ бизнеса</b>

🏢 <b>{business_name}</b>
📉 Прочность: <b>{durability:.1f}%</b>

Ваш бизнес начал производить только <b>70%</b> ресурсов!
Рекомендуем провести ремонт для восстановления полной производительности.

🔧 Нажмите "Ремонт" в меню бизнеса"""
    
    return await send_telegram_message(chat_id, text)


async def notify_durability_warning_20(chat_id: str, business_name: str, durability: float):
    """Notify user when business durability drops below 20% (early warning before critical)"""
    text = f"""⚠️ <b>Прочность бизнеса ниже 20%!</b>

🏢 <b>{business_name}</b>
📉 Прочность: <b>{durability:.1f}%</b>

Ещё немного — и бизнес может <b>остановиться</b> (0% прочности = полная остановка производства).
Сейчас производительность снижена. Рекомендуем <b>срочный ремонт</b>, чтобы избежать простоя.

🔧 Откройте "Мои бизнесы" → выберите бизнес → "Ремонт" """

    return await send_telegram_message(chat_id, text)


async def notify_critical_durability(chat_id: str, business_name: str, durability: float):
    """Notify user when business durability drops below 10%"""
    text = f"""🚨 <b>КРИТИЧЕСКИЙ ИЗНОС!</b>

🏢 <b>{business_name}</b>
📉 Прочность: <b>{durability:.1f}%</b>

⚠️ Ваш бизнес в критическом состоянии!
Производительность снижена до 70%.

<b>Срочно проведите ремонт!</b>

🔧 Откройте "Мои бизнесы" → выберите бизнес → "Ремонт" """
    
    return await send_telegram_message(chat_id, text)


async def notify_business_stopped(chat_id: str, business_name: str):
    """Notify user when business stops due to 0% durability"""
    text = f"""🛑 <b>БИЗНЕС ПРИОСТАНОВЛЕН</b>

🏢 <b>{business_name}</b>
📉 Прочность: <b>0%</b>

❌ Ваш бизнес полностью остановлен!
Производство ресурсов прекращено до полного ремонта.

🔧 Для возобновления работы необходим <b>полный ремонт</b>.
Откройте "Мои бизнесы" → выберите бизнес → "Полный ремонт" """
    
    return await send_telegram_message(chat_id, text)


async def notify_resources_full(chat_id: str, resource_name: str, amount: float, capacity: float = None):
    """Notify user when resources are accumulated"""
    text = f"""📦 <b>Ресурсы накопились!</b>

{resource_name}: <b>{amount:.0f}</b> ед.

💡 Рекомендуем продать ресурсы на маркетплейсе пока цена выгодная!

🛒 Откройте "Маркетплейс" → "Продать ресурсы" """
    
    return await send_telegram_message(chat_id, text)


async def notify_business_sold(chat_id: str, business_name: str, amount: float, tax: float):
    """Notify seller when their business is sold"""
    text = f"""💰 <b>Ваш бизнес продан!</b>

🏢 <b>{business_name}</b>

💵 Получено: <b>+{amount:.2f} TON</b>
📋 Налог: {tax:.2f} TON

Средства зачислены на ваш баланс.

📊 Посмотреть историю → "Операции" """
    
    return await send_telegram_message(chat_id, text)


# ==================== HELPER FUNCTIONS ====================

async def get_user_telegram_chat_id(db, user_id: str) -> Optional[str]:
    """Get user's Telegram chat ID from database"""
    user = await db.users.find_one(
        {"$or": [{"id": user_id}, {"wallet_address": user_id}]},
        {"_id": 0, "telegram_chat_id": 1}
    )
    return user.get("telegram_chat_id") if user else None


# Threshold for resource notification (100 units)
RESOURCE_NOTIFICATION_THRESHOLD = 100

# Track notified states to avoid spam
_notified_states = {}

def should_notify(user_id: str, notification_type: str, key: str = "") -> bool:
    """Check if we should send notification (to avoid spam)"""
    state_key = f"{user_id}:{notification_type}:{key}"
    if state_key in _notified_states:
        return False
    _notified_states[state_key] = True
    return True

def clear_notification_state(user_id: str, notification_type: str, key: str = ""):
    """Clear notification state when condition is resolved"""
    state_key = f"{user_id}:{notification_type}:{key}"
    _notified_states.pop(state_key, None)
