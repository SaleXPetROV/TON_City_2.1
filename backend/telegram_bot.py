"""
TON City Telegram Bot - Full Implementation
Handles user notifications, admin commands, and account management
"""

import os
import logging
import asyncio
import aiohttp
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

def _to_friendly_address_static(address: str) -> str:
    """Convert raw TON address to user-friendly format"""
    try:
        from tonsdk.utils import Address
        return Address(address).to_string(is_user_friendly=True, is_bounceable=True)
    except Exception:
        return address

class TelegramBot:
    """Full-featured Telegram bot for TON City"""
    
    def __init__(self, db):
        self.db = db
        self.api_url = "https://api.telegram.org/bot{token}"
    
    def _to_friendly_address(self, address: str) -> str:
        """Convert raw TON address to user-friendly format"""
        return _to_friendly_address_static(address)
        
    async def get_bot_token(self) -> Optional[str]:
        """Get bot token from env or database"""
        token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        if token:
            return token
            
        # Try to get from database
        settings = await self.db.admin_settings.find_one({"type": "telegram_bot"}, {"_id": 0})
        if settings and settings.get("bot_token"):
            return settings["bot_token"]
            
        game_settings = await self.db.game_settings.find_one({"type": "telegram_settings"}, {"_id": 0})
        if game_settings and game_settings.get("bot_token"):
            return game_settings["bot_token"]
            
        return None
    
    async def get_admin_telegram_id(self) -> Optional[str]:
        """Get admin telegram ID from database"""
        settings = await self.db.admin_settings.find_one({"type": "telegram_bot"}, {"_id": 0})
        return settings.get("admin_telegram_id") if settings else None
    
    async def send_message(self, chat_id: str, text: str, parse_mode: str = "HTML", 
                          reply_markup: Optional[Dict] = None) -> bool:
        """Send a message via Telegram bot"""
        bot_token = await self.get_bot_token()
        if not bot_token or not chat_id:
            logger.warning("Bot token or chat_id not configured")
            return False
        
        try:
            async with aiohttp.ClientSession() as client:
                payload = {
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": parse_mode
                }
                if reply_markup:
                    payload["reply_markup"] = reply_markup
                    
                response = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                )
                
                if response.status == 200:
                    logger.info(f"Telegram message sent to {chat_id}")
                    return True
                else:
                    response_text = await response.text()
                    logger.error(f"Failed to send Telegram message: {response_text}")
                    return False
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return False
    
    async def process_webhook(self, update: Dict) -> Dict:
        """Process incoming webhook update from Telegram"""
        try:
            if not update.get("message"):
                # Handle callback queries (button clicks)
                if update.get("callback_query"):
                    return await self.handle_callback_query(update["callback_query"])
                return {"ok": True}
            
            message = update["message"]
            chat_id = str(message.get("chat", {}).get("id", ""))
            text = message.get("text", "")
            username = message.get("from", {}).get("username", "")
            user_id_tg = str(message.get("from", {}).get("id", ""))
            first_name = message.get("from", {}).get("first_name", "")
            
            if not chat_id:
                return {"ok": True}
            
            # Store user in telegram mappings
            if username or user_id_tg:
                await self.db.telegram_mappings.update_one(
                    {"chat_id": chat_id},
                    {"$set": {
                        "chat_id": chat_id,
                        "telegram_user_id": user_id_tg,
                        "username": username.lower() if username else None,
                        "first_name": first_name,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
            
            # Parse command
            if text.startswith("/"):
                return await self.handle_command(chat_id, text, username, user_id_tg, first_name)
            
            return {"ok": True}
            
        except Exception as e:
            logger.error(f"Telegram webhook error: {e}")
            return {"ok": True}
    
    async def handle_command(self, chat_id: str, text: str, username: str, 
                           user_id_tg: str, first_name: str) -> Dict:
        """Handle bot commands"""
        
        # Parse command and arguments
        parts = text.split()
        command = parts[0].lower().split("@")[0]  # Remove @botname suffix
        args = parts[1:] if len(parts) > 1 else []
        
        # Check if this is admin
        admin_id = await self.get_admin_telegram_id()
        is_admin = admin_id and (user_id_tg == admin_id or chat_id == admin_id)
        
        # Command handlers
        if command == "/start":
            return await self.cmd_start(chat_id, username, first_name, args)
        elif command == "/status" or command == "/balance":
            return await self.cmd_status(chat_id, username, user_id_tg)
        elif command == "/businesses" or command == "/biz":
            return await self.cmd_businesses(chat_id, username, user_id_tg)
        elif command == "/help":
            return await self.cmd_help(chat_id, is_admin)
        elif command == "/link":
            return await self.cmd_link(chat_id, username, args)
        
        # Admin commands
        if is_admin:
            if command == "/admin":
                return await self.cmd_admin(chat_id)
            elif command == "/stats":
                return await self.cmd_admin_stats(chat_id)
            elif command == "/withdrawals" or command == "/wd":
                return await self.cmd_admin_withdrawals(chat_id)
            elif command == "/users":
                return await self.cmd_admin_users(chat_id)
            elif command == "/broadcast":
                return await self.cmd_admin_broadcast(chat_id, " ".join(args))
        
        return {"ok": True}
    
    async def cmd_start(self, chat_id: str, username: str, first_name: str, args: list) -> Dict:
        """Handle /start command"""
        
        # Check if this is a deep link with token
        if args:
            token = args[0]
            return await self.process_link_token(chat_id, username, token)
        
        # Check if user has selected language
        tg_user = await self.db.telegram_mappings.find_one({"chat_id": chat_id}, {"language": 1, "_id": 0})
        
        if not tg_user or not tg_user.get("language"):
            # Show language selection
            msg = """🏙️ <b>TON City</b>

🌍 <b>Выберите язык / Select language:</b>"""
            
            keyboard = {
                "inline_keyboard": [
                    [
                        {"text": "🇷🇺 Русский", "callback_data": "lang_ru"},
                        {"text": "🇬🇧 English", "callback_data": "lang_en"}
                    ]
                ]
            }
            await self.send_message(chat_id, msg, reply_markup=keyboard)
            return {"ok": True}
        
        # Check if user already linked
        user = await self.find_user_by_telegram(chat_id, username)
        lang = tg_user.get("language", "ru")
        
        if user:
            balance = user.get('balance_ton', 0)
            
            if lang == "ru":
                msg = f"""🏙️ <b>TON City</b>

Добро пожаловать, <b>{user.get('username', first_name)}!</b>

💰 Баланс: <b>{balance:.2f} TON</b> ({balance * 1000:,.0f} $CITY)"""
            else:
                msg = f"""🏙️ <b>TON City</b>

Welcome back, <b>{user.get('username', first_name)}!</b>

💰 Balance: <b>{balance:.2f} TON</b> ({balance * 1000:,.0f} $CITY)"""
            
            keyboard = {
                "inline_keyboard": [
                    [
                        {"text": "💰 Баланс" if lang == "ru" else "💰 Balance", "callback_data": "status"},
                        {"text": "🏢 Бизнесы" if lang == "ru" else "🏢 Businesses", "callback_data": "businesses"}
                    ],
                    [
                        {"text": "🎮 Открыть игру" if lang == "ru" else "🎮 Open Game", "url": "https://ton-builder.preview.emergentagent.com"}
                    ],
                    [
                        {"text": "⚙️ Настройки" if lang == "ru" else "⚙️ Settings", "callback_data": "settings"},
                        {"text": "❓ Помощь" if lang == "ru" else "❓ Help", "callback_data": "help"}
                    ]
                ]
            }
        else:
            if lang == "ru":
                msg = f"""🏙️ <b>TON City</b>

Привет, <b>{first_name or 'друг'}!</b>

Это официальный бот TON City - экономической игры на блокчейне TON.

🔗 <b>Привязка аккаунта:</b>
Для доступа ко всем функциям привяжите Telegram к аккаунту TON City."""
            else:
                msg = f"""🏙️ <b>TON City</b>

Hello, <b>{first_name or 'friend'}!</b>

This is the official TON City bot - blockchain economy game on TON.

🔗 <b>Link Account:</b>
Link your Telegram to your TON City account to access all features."""
            
            keyboard = {
                "inline_keyboard": [
                    [
                        {"text": "🎮 Открыть игру" if lang == "ru" else "🎮 Open Game", "url": "https://ton-builder.preview.emergentagent.com"}
                    ],
                    [
                        {"text": "🔗 Как привязать" if lang == "ru" else "🔗 How to Link", "callback_data": "how_to_link"}
                    ],
                    [
                        {"text": "❓ Помощь" if lang == "ru" else "❓ Help", "callback_data": "help"}
                    ]
                ]
            }
        
        await self.send_message(chat_id, msg, reply_markup=keyboard)
        return {"ok": True}
    
    async def process_link_token(self, chat_id: str, username: str, token: str) -> Dict:
        """Process account linking via deep link token"""
        # Get token data from database or memory cache
        # This should match the token generated in server.py
        from server import telegram_link_tokens
        
        if token not in telegram_link_tokens:
            await self.send_message(
                chat_id, 
                "❌ <b>Недействительный токен</b>\n\nСгенерируйте новую ссылку на сайте TON City."
            )
            return {"ok": True}
        
        token_data = telegram_link_tokens[token]
        
        # Check expiry
        if datetime.now(timezone.utc) > token_data["expires_at"]:
            del telegram_link_tokens[token]
            await self.send_message(
                chat_id, 
                "❌ <b>Токен истёк</b>\n\nСгенерируйте новую ссылку на сайте TON City."
            )
            return {"ok": True}
        
        # Link account
        update_data = {
            "telegram_chat_id": chat_id,
            "telegram_notifications": True
        }
        if username:
            update_data["telegram_username"] = username.lower()
        
        await self.db.users.update_one(
            {"id": token_data["user_id"]},
            {"$set": update_data}
        )
        
        # Remove used token
        del telegram_link_tokens[token]
        
        # Get user info
        user = await self.db.users.find_one({"id": token_data["user_id"]}, {"_id": 0})
        
        msg = f"""✅ <b>Аккаунт привязан!</b>

Теперь вы будете получать уведомления о:
📢 Состоянии ваших бизнесов
💰 Пополнениях и выводах
🔔 Важных событиях игры

<b>Ваш аккаунт:</b>
👤 {user.get('username', 'Unknown')}
💰 Баланс: {user.get('balance_ton', 0):.2f} TON"""
        
        await self.send_message(chat_id, msg)
        return {"ok": True}
    
    async def cmd_status(self, chat_id: str, username: str, user_id_tg: str) -> Dict:
        """Handle /status command"""
        user = await self.find_user_by_telegram(chat_id, username)
        
        if not user:
            await self.send_message(
                chat_id, 
                "❌ <b>Аккаунт не привязан</b>\n\nПривяжите Telegram к аккаунту TON City через настройки на сайте."
            )
            return {"ok": True}
        
        # Count businesses
        businesses_count = await self.db.businesses.count_documents({
            "$or": [{"owner": user.get("id")}, {"owner_wallet": user.get("wallet_address")}]
        })
        
        # Конвертируем адрес в friendly формат
        wallet_addr = user.get('wallet_address', '')
        friendly_wallet = self._to_friendly_address(wallet_addr) if wallet_addr else 'Не привязан'
        
        msg = f"""📊 <b>Статус аккаунта</b>

👤 <b>{user.get('username', 'Unknown')}</b>
📈 Уровень: <b>{user.get('level', 1)}</b>
⭐ XP: <b>{user.get('xp', 0)}</b>

💳 Кошелёк: <code>{friendly_wallet}</code>

💰 <b>Финансы:</b>
• Баланс: <b>{user.get('balance_ton', 0):.4f} TON</b>
• Общий доход: <b>{user.get('total_income', 0):.2f} TON</b>
• Оборот: <b>{user.get('total_turnover', 0):.2f} TON</b>

🏢 Бизнесов: <b>{businesses_count}</b>"""
        
        await self.send_message(chat_id, msg)
        return {"ok": True}
    
    async def cmd_businesses(self, chat_id: str, username: str, user_id_tg: str) -> Dict:
        """Handle /businesses command"""
        user = await self.find_user_by_telegram(chat_id, username)
        
        if not user:
            await self.send_message(
                chat_id, 
                "❌ <b>Аккаунт не привязан</b>"
            )
            return {"ok": True}
        
        # Get user businesses
        businesses = await self.db.businesses.find({
            "$or": [{"owner": user.get("id")}, {"owner_wallet": user.get("wallet_address")}]
        }, {"_id": 0}).to_list(20)
        
        if not businesses:
            await self.send_message(chat_id, "🏢 У вас пока нет бизнесов.")
            return {"ok": True}
        
        msg = "🏢 <b>Ваши бизнесы:</b>\n\n"
        
        for biz in businesses:
            durability = biz.get("durability", 100)
            status_emoji = "🟢" if durability >= 70 else "🟡" if durability >= 30 else "🔴"
            
            msg += f"""{status_emoji} <b>{biz.get('name', biz.get('business_type', '?'))}</b>
   📍 Координаты: [{biz.get('x', '?')}, {biz.get('y', '?')}]
   📊 Уровень: {biz.get('level', 1)}
   🔧 Прочность: {durability:.0f}%
   
"""
        
        await self.send_message(chat_id, msg)
        return {"ok": True}
    
    async def cmd_help(self, chat_id: str, is_admin: bool) -> Dict:
        """Handle /help command"""
        tg_user = await self.db.telegram_mappings.find_one({"chat_id": chat_id}, {"language": 1, "_id": 0})
        lang = tg_user.get("language", "ru") if tg_user else "ru"
        
        if lang == "ru":
            msg = """📚 <b>Помощь TON City Bot</b>

<b>💰 Финансы:</b>
• Проверить баланс и бизнесы
• Пополнить баланс (через сайт)
• Вывести средства

<b>🔔 Уведомления:</b>
Бот присылает уведомления о:
• Пополнениях и выводах
• Износе бизнесов
• Важных объявлениях

<b>🔗 Привязка:</b>
Для доступа ко всем функциям привяжите Telegram в настройках на сайте."""
        else:
            msg = """📚 <b>TON City Bot Help</b>

<b>💰 Finance:</b>
• Check balance and businesses
• Deposit funds (via website)
• Withdraw funds

<b>🔔 Notifications:</b>
Bot sends notifications about:
• Deposits and withdrawals
• Business durability
• Important announcements

<b>🔗 Linking:</b>
Link your Telegram in website settings for full access."""
        
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "💰 Баланс" if lang == "ru" else "💰 Balance", "callback_data": "status"},
                    {"text": "🏢 Бизнесы" if lang == "ru" else "🏢 Businesses", "callback_data": "businesses"}
                ],
                [{"text": "🎮 Открыть игру" if lang == "ru" else "🎮 Open Game", "url": "https://ton-builder.preview.emergentagent.com"}],
                [{"text": "◀️ Главное меню" if lang == "ru" else "◀️ Main Menu", "callback_data": "back_to_menu"}]
            ]
        }
        
        if is_admin:
            if lang == "ru":
                msg += """

<b>🔑 Админ:</b>
• /admin - Панель админа
• /stats - Статистика
• /withdrawals - Заявки на вывод"""
            else:
                msg += """

<b>🔑 Admin:</b>
• /admin - Admin panel
• /stats - Statistics
• /withdrawals - Withdrawal requests"""
        
        await self.send_message(chat_id, msg, reply_markup=keyboard)
        return {"ok": True}
    
    async def cmd_link(self, chat_id: str, username: str, args: list) -> Dict:
        """Handle /link command"""
        await self.send_message(
            chat_id,
            """🔗 <b>Привязка аккаунта</b>

Чтобы привязать этот Telegram к TON City:

1️⃣ Откройте сайт TON City
2️⃣ Перейдите в Настройки → Telegram  
3️⃣ Нажмите "Привязать Telegram"
4️⃣ Перейдите по сгенерированной ссылке

После этого вы будете получать уведомления прямо сюда! 🔔"""
        )
        return {"ok": True}
    
    async def cmd_withdraw(self, chat_id: str, username: str, user_id_tg: str, args: list) -> Dict:
        """Handle /withdraw command - create withdrawal request"""
        user = await self.find_user_by_telegram(chat_id, username)
        
        if not user:
            await self.send_message(
                chat_id, 
                "❌ <b>Аккаунт не привязан</b>\n\nПривяжите Telegram к аккаунту TON City через настройки на сайте."
            )
            return {"ok": True}
        
        # Check if user has wallet
        if not user.get("wallet_address"):
            await self.send_message(
                chat_id,
                "❌ <b>Кошелёк не привязан</b>\n\nДля вывода средств сначала привяжите TON кошелёк на сайте TON City."
            )
            return {"ok": True}
        
        # Check withdrawal block
        block_until = user.get("withdrawal_blocked_until")
        if block_until:
            try:
                block_time = datetime.fromisoformat(block_until.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) < block_time:
                    await self.send_message(
                        chat_id,
                        f"🔒 <b>Вывод заблокирован</b>\n\nДо {block_time.strftime('%d.%m.%Y %H:%M:%S')} UTC\n(блокировка после изменения настроек 2FA)"
                    )
                    return {"ok": True}
            except:
                pass
        
        balance = user.get("balance_ton", 0)
        min_withdrawal = 1.0  # Minimum withdrawal amount
        
        if not args:
            await self.send_message(
                chat_id,
                f"""💸 <b>Вывод средств</b>

💰 Ваш баланс: <b>{balance:.4f} TON</b>
📤 Минимум для вывода: <b>{min_withdrawal} TON</b>

<b>Использование:</b>
<code>/withdraw [сумма]</code>

<b>Пример:</b>
<code>/withdraw 5</code> - вывести 5 TON
<code>/withdraw all</code> - вывести всё"""
            )
            return {"ok": True}
        
        # Parse amount
        amount_str = args[0].lower()
        if amount_str == "all" or amount_str == "всё":
            amount = balance
        else:
            try:
                amount = float(amount_str)
            except ValueError:
                await self.send_message(chat_id, "❌ Некорректная сумма. Введите число.")
                return {"ok": True}
        
        # Validate amount
        if amount < min_withdrawal:
            await self.send_message(chat_id, f"❌ Минимальная сумма вывода: <b>{min_withdrawal} TON</b>")
            return {"ok": True}
        
        if amount > balance:
            await self.send_message(chat_id, f"❌ Недостаточно средств. Баланс: <b>{balance:.4f} TON</b>")
            return {"ok": True}
        
        # Create withdrawal request
        import uuid
        tx_id = str(uuid.uuid4())
        
        # Calculate fee (example: 5%)
        fee_percent = 5
        fee = amount * fee_percent / 100
        net_amount = amount - fee
        
        wallet_addr = user.get("wallet_address", "")
        friendly_wallet = self._to_friendly_address(wallet_addr) if wallet_addr else wallet_addr
        
        await self.db.transactions.insert_one({
            "id": tx_id,
            "user_id": user["id"],
            "tx_type": "withdrawal",
            "amount": amount,
            "fee": fee,
            "net_amount": net_amount,
            "wallet_address": wallet_addr,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source": "telegram_bot"
        })
        
        # Deduct from balance
        await self.db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"balance_ton": -amount}}
        )
        
        await self.send_message(
            chat_id,
            f"""✅ <b>Заявка на вывод создана!</b>

💵 Сумма: <b>{amount:.4f} TON</b>
💸 Комиссия ({fee_percent}%): <b>{fee:.4f} TON</b>
📤 К выводу: <b>{net_amount:.4f} TON</b>

📬 Кошелёк: <code>{friendly_wallet}</code>

⏳ Статус: <b>Ожидает подтверждения</b>
🆔 ID: <code>{tx_id[:8]}</code>

Администратор рассмотрит вашу заявку в ближайшее время."""
        )
        
        # Notify admin
        await self.notify_admin(
            f"""📤 <b>Новая заявка на вывод!</b>

👤 {user.get('username', 'Unknown')}
💵 Сумма: <b>{amount:.4f} TON</b>
📬 Кошелёк: <code>{friendly_wallet}</code>
🆔 ID: <code>{tx_id[:8]}</code>

/withdrawals - посмотреть все заявки"""
        )
        
        return {"ok": True}
    
    async def cmd_deposit(self, chat_id: str, username: str, user_id_tg: str) -> Dict:
        """Handle /deposit command - show deposit instructions"""
        user = await self.find_user_by_telegram(chat_id, username)
        
        if not user:
            await self.send_message(
                chat_id, 
                "❌ <b>Аккаунт не привязан</b>\n\nПривяжите Telegram к аккаунту TON City через настройки на сайте."
            )
            return {"ok": True}
        
        # Check if user has linked wallet
        if not user.get("wallet_address"):
            tg_user = await self.db.telegram_mappings.find_one({"chat_id": chat_id}, {"language": 1, "_id": 0})
            lang = tg_user.get("language", "ru") if tg_user else "ru"
            
            if lang == "ru":
                msg = """❌ <b>Кошелёк не привязан</b>

Для пополнения баланса необходимо сначала привязать TON кошелёк к вашему аккаунту.

📱 <b>Как привязать:</b>
1. Зайдите на сайт TON City
2. Откройте <b>Настройки</b>
3. В разделе <b>TON Кошелёк</b> нажмите "Привязать"
4. Подтвердите в приложении кошелька

После привязки кошелька вы сможете пополнять баланс."""
            else:
                msg = """❌ <b>Wallet not linked</b>

To deposit funds, you first need to link a TON wallet to your account.

📱 <b>How to link:</b>
1. Go to TON City website
2. Open <b>Settings</b>
3. In <b>TON Wallet</b> section click "Link"
4. Confirm in your wallet app

After linking your wallet, you will be able to deposit funds."""
            
            keyboard = {
                "inline_keyboard": [
                    [{"text": "🎮 Открыть настройки" if lang == "ru" else "🎮 Open Settings", "url": "https://ton-builder.preview.emergentagent.com/settings?tab=wallet"}],
                    [{"text": "◀️ Назад" if lang == "ru" else "◀️ Back", "callback_data": "back_to_menu"}]
                ]
            }
            
            await self.send_message(chat_id, msg, reply_markup=keyboard)
            return {"ok": True}
        
        # Get deposit wallet (treasury wallet)
        settings = await self.db.admin_settings.find_one({"type": "payment_settings"}, {"_id": 0})
        deposit_wallet = settings.get("deposit_wallet") if settings else None
        
        if not deposit_wallet:
            deposit_wallet = "EQC...TON_CITY_WALLET"  # Placeholder
        
        friendly_deposit = self._to_friendly_address(deposit_wallet) if deposit_wallet else deposit_wallet
        
        await self.send_message(
            chat_id,
            f"""💰 <b>Пополнение баланса</b>

Для пополнения баланса TON City отправьте TON на кошелёк:

📬 <code>{friendly_deposit}</code>

⚠️ <b>ВАЖНО:</b>
• В комментарии к переводу укажите ваш ID:
  <code>{user.get('id', '')[:8]}</code>
• Минимальная сумма: <b>1 TON</b>
• Зачисление автоматическое (1-5 мин)

💡 Или пополните через сайт TON City - там удобнее и быстрее!

💳 Текущий баланс: <b>{user.get('balance_ton', 0):.4f} TON</b>"""
        )
        
        return {"ok": True}
    
    # ==================== ADMIN COMMANDS ====================
    
    async def cmd_admin(self, chat_id: str) -> Dict:
        """Admin panel overview"""
        # Get stats
        users_count = await self.db.users.count_documents({})
        businesses_count = await self.db.businesses.count_documents({})
        pending_withdrawals = await self.db.transactions.count_documents({
            "tx_type": "withdrawal", "status": "pending"
        })
        
        stats = await self.db.admin_stats.find_one({"type": "treasury"}, {"_id": 0})
        total_deposits = stats.get("total_deposits", 0) if stats else 0
        total_withdrawals = stats.get("total_withdrawals", 0) if stats else 0
        
        msg = f"""👑 <b>Админ-панель TON City</b>

📊 <b>Статистика:</b>
• Пользователей: <b>{users_count}</b>
• Бизнесов: <b>{businesses_count}</b>
• Депозитов: <b>{total_deposits:.2f} TON</b>
• Выводов: <b>{total_withdrawals:.2f} TON</b>

⏳ <b>Ожидают:</b>
• Выводов: <b>{pending_withdrawals}</b>

<b>Команды:</b>
/stats - Подробная статистика
/withdrawals - Ожидающие выводы
/users - Пользователи
/broadcast [текст] - Рассылка"""
        
        await self.send_message(chat_id, msg)
        return {"ok": True}
    
    async def cmd_admin_stats(self, chat_id: str) -> Dict:
        """Detailed admin stats"""
        stats = await self.db.admin_stats.find_one({"type": "treasury"}, {"_id": 0})
        
        if not stats:
            await self.send_message(chat_id, "📊 Статистика пока пуста")
            return {"ok": True}
        
        msg = f"""📊 <b>Детальная статистика</b>

💰 <b>Финансы:</b>
• Депозиты: <b>{stats.get('total_deposits', 0):.2f} TON</b>
• Выводы: <b>{stats.get('total_withdrawals', 0):.2f} TON</b>
• Комиссии с выводов: <b>{stats.get('withdrawal_fees', 0):.4f} TON</b>

🏘️ <b>Продажи:</b>
• Продажа земли: <b>{stats.get('total_plot_sales', 0):.2f} TON</b>
• Налоги: <b>{stats.get('total_tax', 0):.2f} TON</b>

📈 <b>Транзакции:</b>
• Кол-во депозитов: <b>{stats.get('deposits_count', 0)}</b>
• Кол-во выводов: <b>{stats.get('total_withdrawals_count', 0)}</b>"""
        
        await self.send_message(chat_id, msg)
        return {"ok": True}
    
    async def cmd_admin_withdrawals(self, chat_id: str) -> Dict:
        """List pending withdrawals with inline action buttons"""
        withdrawals = await self.db.transactions.find({
            "tx_type": "withdrawal", "status": "pending"
        }, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
        
        if not withdrawals:
            await self.send_message(
                chat_id, 
                "✅ Нет ожидающих выводов",
                reply_markup={
                    "inline_keyboard": [[
                        {"text": "🔄 Обновить", "callback_data": "refresh_withdrawals"}
                    ]]
                }
            )
            return {"ok": True}
        
        # Send each withdrawal as separate message with buttons
        await self.send_message(chat_id, f"⏳ <b>Ожидающие выводы ({len(withdrawals)}):</b>")
        
        for wd in withdrawals:
            tx_id = wd.get("id", "")
            amount = wd.get("amount_ton", abs(wd.get("amount", 0)))
            net_amount = wd.get("net_amount", amount)
            commission = wd.get("commission", 0)
            
            # Полный адрес в friendly формате
            raw_addr = wd.get('user_wallet') or wd.get('to_address') or '?'
            full_address = wd.get('to_address_display') or self._to_friendly_address(raw_addr)
            
            msg = f"""👤 <b>{wd.get('user_username', 'Unknown')}</b>

💰 Сумма: <b>{amount:.4f} TON</b>
💸 К выплате: <b>{net_amount:.4f} TON</b>
📊 Комиссия: <b>{commission:.4f} TON</b>

📍 Адрес: <code>{full_address}</code>
📅 {wd.get('created_at', '')[:16]}"""
            
            # Inline buttons for approve/reject
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Одобрить", "callback_data": f"approve_wd_{tx_id}"},
                        {"text": "❌ Отклонить", "callback_data": f"reject_wd_{tx_id}"}
                    ]
                ]
            }
            
            await self.send_message(chat_id, msg, reply_markup=reply_markup)
        
        return {"ok": True}
    
    async def cmd_admin_users(self, chat_id: str) -> Dict:
        """List recent users"""
        users = await self.db.users.find(
            {}, 
            {"_id": 0, "hashed_password": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        msg = f"👥 <b>Последние пользователи ({len(users)}):</b>\n\n"
        
        for user in users:
            msg += f"""• <b>{user.get('username', 'Unknown')}</b>
  💰 {user.get('balance_ton', 0):.2f} TON
  📈 Уровень: {user.get('level', 1)}

"""
        
        await self.send_message(chat_id, msg)
        return {"ok": True}
    
    async def cmd_admin_broadcast(self, chat_id: str, message: str) -> Dict:
        """Broadcast message to all users with telegram"""
        if not message:
            await self.send_message(
                chat_id, 
                "❌ Укажите текст рассылки: /broadcast [текст]"
            )
            return {"ok": True}
        
        # Get all users with telegram_chat_id
        users = await self.db.users.find(
            {"telegram_chat_id": {"$exists": True, "$ne": None}},
            {"_id": 0, "telegram_chat_id": 1, "username": 1}
        ).to_list(1000)
        
        if not users:
            await self.send_message(chat_id, "❌ Нет пользователей с привязанным Telegram")
            return {"ok": True}
        
        broadcast_msg = f"📢 <b>Объявление от TON City</b>\n\n{message}"
        
        success = 0
        failed = 0
        
        for user in users:
            try:
                result = await self.send_message(user["telegram_chat_id"], broadcast_msg)
                if result:
                    success += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
        
        await self.send_message(
            chat_id, 
            f"✅ <b>Рассылка завершена</b>\n\n📤 Отправлено: {success}\n❌ Ошибок: {failed}"
        )
        return {"ok": True}
    
    async def handle_callback_query(self, callback_query: Dict) -> Dict:
        """Handle button callback queries"""
        try:
            callback_id = callback_query.get("id")
            data = callback_query.get("data", "")
            chat_id = str(callback_query.get("from", {}).get("id", ""))
            message_id = callback_query.get("message", {}).get("message_id")
            username = callback_query.get("from", {}).get("username", "")
            first_name = callback_query.get("from", {}).get("first_name", "")
            user_id_tg = str(callback_query.get("from", {}).get("id", ""))
            
            # Language selection
            if data.startswith("lang_"):
                lang = data.replace("lang_", "")
                await self.db.telegram_mappings.update_one(
                    {"chat_id": chat_id},
                    {"$set": {"language": lang}},
                    upsert=True
                )
                await self.answer_callback(callback_id, "✅ Язык выбран / Language selected")
                # Show main menu
                return await self.cmd_start(chat_id, username, first_name, [])
            
            # User commands
            if data == "status":
                await self.answer_callback(callback_id, "💰")
                return await self.cmd_status(chat_id, username, user_id_tg)
            
            if data == "businesses":
                await self.answer_callback(callback_id, "🏢")
                return await self.cmd_businesses(chat_id, username, user_id_tg)
            
            if data == "help":
                await self.answer_callback(callback_id, "❓")
                admin_id = await self.get_admin_telegram_id()
                is_admin = admin_id and (user_id_tg == admin_id or chat_id == admin_id)
                return await self.cmd_help(chat_id, is_admin)
            
            if data == "settings":
                await self.answer_callback(callback_id, "⚙️")
                return await self.show_settings(chat_id)
            
            if data == "how_to_link":
                await self.answer_callback(callback_id, "🔗")
                return await self.show_link_instructions(chat_id)
            
            if data == "back_to_menu":
                await self.answer_callback(callback_id, "🏠")
                return await self.cmd_start(chat_id, username, first_name, [])
            
            # Change language
            if data == "change_lang":
                # Reset language to force selection
                await self.db.telegram_mappings.update_one(
                    {"chat_id": chat_id},
                    {"$unset": {"language": ""}}
                )
                await self.answer_callback(callback_id, "🌍")
                return await self.cmd_start(chat_id, username, first_name, [])
            
            # Admin commands - check if admin
            admin_id = await self.get_admin_telegram_id()
            if admin_id and (chat_id == admin_id or user_id_tg == admin_id):
                if data.startswith("approve_wd_"):
                    tx_id = data.replace("approve_wd_", "")
                    return await self.process_withdrawal_action(callback_id, chat_id, message_id, tx_id, "approve")
                
                elif data.startswith("reject_wd_"):
                    tx_id = data.replace("reject_wd_", "")
                    return await self.process_withdrawal_action(callback_id, chat_id, message_id, tx_id, "reject")
                
                elif data == "refresh_withdrawals":
                    await self.answer_callback(callback_id, "🔄 Обновляю...")
                    return await self.cmd_admin_withdrawals(chat_id)
            
            await self.answer_callback(callback_id, "OK")
            return {"ok": True}
            
        except Exception as e:
            logger.error(f"Callback query error: {e}")
            return {"ok": True}
    
    async def show_settings(self, chat_id: str) -> Dict:
        """Show settings menu"""
        tg_user = await self.db.telegram_mappings.find_one({"chat_id": chat_id}, {"language": 1, "_id": 0})
        lang = tg_user.get("language", "ru") if tg_user else "ru"
        
        if lang == "ru":
            msg = """⚙️ <b>Настройки</b>

Текущий язык: 🇷🇺 Русский"""
        else:
            msg = """⚙️ <b>Settings</b>

Current language: 🇬🇧 English"""
        
        keyboard = {
            "inline_keyboard": [
                [{"text": "🌍 Сменить язык / Change Language", "callback_data": "change_lang"}],
                [{"text": "◀️ Назад" if lang == "ru" else "◀️ Back", "callback_data": "back_to_menu"}]
            ]
        }
        
        await self.send_message(chat_id, msg, reply_markup=keyboard)
        return {"ok": True}
    
    async def show_link_instructions(self, chat_id: str) -> Dict:
        """Show how to link account"""
        tg_user = await self.db.telegram_mappings.find_one({"chat_id": chat_id}, {"language": 1, "_id": 0})
        lang = tg_user.get("language", "ru") if tg_user else "ru"
        
        if lang == "ru":
            msg = """🔗 <b>Как привязать Telegram к аккаунту TON City:</b>

1️⃣ Зайдите на сайт TON City
2️⃣ Войдите в свой аккаунт
3️⃣ Откройте <b>Настройки</b> → <b>Telegram</b>
4️⃣ Нажмите <b>"Привязать Telegram"</b>
5️⃣ Откроется этот бот - готово!

После привязки вы будете получать уведомления о:
• 💰 Пополнениях и выводах
• 🏢 Доходах от бизнесов
• 📢 Важных объявлениях"""
        else:
            msg = """🔗 <b>How to link Telegram to TON City account:</b>

1️⃣ Go to TON City website
2️⃣ Login to your account
3️⃣ Open <b>Settings</b> → <b>Telegram</b>
4️⃣ Click <b>"Link Telegram"</b>
5️⃣ This bot will open - done!

After linking you will receive notifications about:
• 💰 Deposits and withdrawals
• 🏢 Business income
• 📢 Important announcements"""
        
        keyboard = {
            "inline_keyboard": [
                [{"text": "🎮 Открыть игру" if lang == "ru" else "🎮 Open Game", "url": "https://ton-builder.preview.emergentagent.com"}],
                [{"text": "◀️ Назад" if lang == "ru" else "◀️ Back", "callback_data": "back_to_menu"}]
            ]
        }
        
        await self.send_message(chat_id, msg, reply_markup=keyboard)
        return {"ok": True}
    
    async def answer_callback(self, callback_id: str, text: str):
        """Answer callback query"""
        bot_token = await self.get_bot_token()
        if not bot_token:
            return
        
        try:
            async with aiohttp.ClientSession() as client:
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery",
                    json={"callback_query_id": callback_id, "text": text},
                    timeout=aiohttp.ClientTimeout(total=5)
                )
        except Exception as e:
            logger.error(f"Answer callback error: {e}")
    
    async def edit_message(self, chat_id: str, message_id: int, text: str, reply_markup: Dict = None):
        """Edit existing message"""
        bot_token = await self.get_bot_token()
        if not bot_token:
            return False
        
        try:
            async with aiohttp.ClientSession() as client:
                payload = {
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": text,
                    "parse_mode": "HTML"
                }
                if reply_markup:
                    payload["reply_markup"] = reply_markup
                
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/editMessageText",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                )
                return True
        except Exception as e:
            logger.error(f"Edit message error: {e}")
            return False
    
    async def process_withdrawal_action(self, callback_id: str, chat_id: str, 
                                        message_id: int, tx_id: str, action: str) -> Dict:
        """Process withdrawal approve/reject from telegram"""
        try:
            # Find transaction
            tx = await self.db.transactions.find_one({"id": tx_id})
            if not tx:
                await self.answer_callback(callback_id, "❌ Заявка не найдена")
                return {"ok": True}
            
            if tx.get("status") != "pending":
                await self.answer_callback(callback_id, "⚠️ Заявка уже обработана")
                return {"ok": True}
            
            if action == "approve":
                # Call the approval logic
                result = await self.approve_withdrawal_internal(tx)
                if result.get("success"):
                    await self.answer_callback(callback_id, "✅ Вывод одобрен!")
                    await self.edit_message(
                        chat_id, message_id,
                        f"✅ <b>ОДОБРЕНО</b>\n\n"
                        f"👤 {tx.get('user_username', 'Unknown')}\n"
                        f"💰 {tx.get('net_amount', 0):.2f} TON\n"
                        f"🔗 TX: <code>{result.get('hash', 'N/A')[:20]}...</code>"
                    )
                else:
                    await self.answer_callback(callback_id, f"❌ {result.get('error', 'Ошибка')}")
            
            elif action == "reject":
                result = await self.reject_withdrawal_internal(tx)
                if result.get("success"):
                    await self.answer_callback(callback_id, "❌ Вывод отклонён")
                    await self.edit_message(
                        chat_id, message_id,
                        f"❌ <b>ОТКЛОНЕНО</b>\n\n"
                        f"👤 {tx.get('user_username', 'Unknown')}\n"
                        f"💰 {abs(tx.get('amount_ton', tx.get('amount', 0))):.2f} TON возвращено"
                    )
                else:
                    await self.answer_callback(callback_id, f"❌ {result.get('error', 'Ошибка')}")
            
            return {"ok": True}
            
        except Exception as e:
            logger.error(f"Process withdrawal action error: {e}")
            await self.answer_callback(callback_id, f"❌ Ошибка: {str(e)[:30]}")
            return {"ok": True}
    
    async def approve_withdrawal_internal(self, tx: Dict) -> Dict:
        """Internal method to approve withdrawal - mirrors server.py logic"""
        try:
            import os
            from ton_integration import ton_client
            
            user_wallet = tx.get("user_wallet")
            user = await self.db.users.find_one({"wallet_address": user_wallet})
            
            # Get destination address
            destination_address = None
            if user:
                destination_address = user.get("raw_address") or user.get("wallet_address")
            if not destination_address:
                destination_address = tx.get("user_raw_address") or tx.get("to_address") or user_wallet
            
            if not destination_address:
                return {"success": False, "error": "Адрес не найден"}
            
            # Get mnemonic
            sender_wallet = await self.db.admin_settings.find_one({"type": "sender_wallet"}, {"_id": 0})
            seed = sender_wallet.get("mnemonic") if sender_wallet else None
            if not seed:
                seed = os.getenv("TON_WALLET_MNEMONIC")
            
            if not seed:
                return {"success": False, "error": "Мнемоника не настроена"}
            
            net_amount = float(tx.get("net_amount", 0))
            commission = float(tx.get("commission", 0))
            
            # Получаем username для комментария
            user_username = ""
            if user:
                user_username = user.get("username", "")
            
            # Send TON
            tx_hash = await ton_client.send_ton_payout(
                dest_address=destination_address,
                amount_ton=net_amount,
                mnemonics=seed,
                user_username=user_username
            )
            
            # Update transaction
            now_iso = datetime.now(timezone.utc).isoformat()
            await self.db.transactions.update_one(
                {"id": tx["id"]},
                {"$set": {
                    "status": "completed",
                    "completed_at": now_iso,
                    "blockchain_hash": tx_hash,
                    "from_address": "Система",
                    "to_address": user_wallet
                }}
            )
            
            # Update stats
            await self.db.admin_stats.update_one(
                {"type": "treasury"},
                {"$inc": {"withdrawal_fees": commission, "total_withdrawals": net_amount, "total_withdrawals_count": 1}},
                upsert=True
            )
            
            # Notify user
            if tx.get("user_id"):
                await self.notify_withdrawal_approved(tx.get("user_id"), net_amount, tx_hash)
            
            return {"success": True, "hash": tx_hash}
            
        except Exception as e:
            logger.error(f"Approve withdrawal internal error: {e}")
            # Refund on error
            amount_ton_original = float(tx.get("amount_ton", 0))
            if amount_ton_original <= 0:
                amount_ton_original = float(tx.get("net_amount", 0)) + float(tx.get("commission", 0))
            
            await self.db.users.update_one(
                {"wallet_address": tx.get("user_wallet")},
                {"$inc": {"balance_ton": amount_ton_original}}
            )
            await self.db.transactions.update_one(
                {"id": tx["id"]},
                {"$set": {"status": "failed", "error": str(e)}}
            )
            return {"success": False, "error": str(e)}
    
    async def reject_withdrawal_internal(self, tx: Dict) -> Dict:
        """Internal method to reject withdrawal"""
        try:
            user_address = tx.get("user_wallet") or tx.get("from_address")
            user_id = tx.get("user_id")
            amount_to_return = float(tx.get("amount_ton") or abs(tx.get("amount", 0)))
            
            if amount_to_return <= 0:
                return {"success": False, "error": "Сумма для возврата не указана"}
            
            # Return funds
            or_conditions = []
            if user_id:
                or_conditions.append({"id": user_id})
            if user_address:
                or_conditions.append({"wallet_address": user_address})
                or_conditions.append({"raw_address": user_address})
            
            if not or_conditions:
                return {"success": False, "error": "Пользователь не найден"}
            
            update_result = await self.db.users.update_one(
                {"$or": or_conditions},
                {"$inc": {"balance_ton": amount_to_return}}
            )
            
            if update_result.modified_count > 0:
                await self.db.transactions.update_one(
                    {"id": tx["id"]},
                    {"$set": {
                        "status": "rejected",
                        "rejected_at": datetime.now(timezone.utc).isoformat(),
                        "admin_note": f"Отклонено через Telegram. Возвращено {amount_to_return} TON"
                    }}
                )
                
                # Notify user
                if user_id:
                    await self.notify_withdrawal_rejected(user_id, amount_to_return, "Отклонено администратором")
                
                return {"success": True}
            else:
                return {"success": False, "error": "Пользователь не найден для возврата"}
                
        except Exception as e:
            logger.error(f"Reject withdrawal internal error: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== NOTIFICATION HELPERS ====================
    
    async def find_user_by_telegram(self, chat_id: str, username: str = None) -> Optional[Dict]:
        """Find user by telegram chat_id (primary) or username (fallback)"""
        # First try to find by chat_id (most reliable)
        user = await self.db.users.find_one(
            {"telegram_chat_id": str(chat_id)}, 
            {"_id": 0, "hashed_password": 0}
        )
        if user:
            return user
        
        # Fallback to username if chat_id not found
        if username:
            user = await self.db.users.find_one(
                {"telegram_username": username.lower()}, 
                {"_id": 0, "hashed_password": 0}
            )
            if user:
                # Update chat_id for future lookups
                await self.db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"telegram_chat_id": str(chat_id)}}
                )
                return user
        
        return None
    
    async def notify_user(self, user_id: str, message: str) -> bool:
        """Send notification to user if they have telegram linked"""
        user = await self.db.users.find_one(
            {"id": user_id},
            {"_id": 0, "telegram_chat_id": 1, "telegram_notifications": 1}
        )
        
        if not user or not user.get("telegram_chat_id"):
            return False
        
        if not user.get("telegram_notifications", True):
            return False
        
        return await self.send_message(user["telegram_chat_id"], message)
    
    async def notify_admin(self, message: str) -> bool:
        """Send notification to admin"""
        admin_id = await self.get_admin_telegram_id()
        if not admin_id:
            return False
        
        return await self.send_message(admin_id, message)
    
    # ==================== BUSINESS NOTIFICATIONS ====================
    
    async def notify_low_durability(self, user_id: str, business_name: str, durability: float):
        """Notify user when business durability drops below 50%"""
        msg = f"""⚠️ <b>Внимание! Износ бизнеса</b>

🏢 <b>{business_name}</b>
📉 Прочность: <b>{durability:.1f}%</b>

Ваш бизнес начал производить только <b>70%</b> ресурсов!
Рекомендуем провести ремонт.

🔧 Откройте "Мои бизнесы" на сайте"""
        
        return await self.notify_user(user_id, msg)
    
    async def notify_critical_durability(self, user_id: str, business_name: str, durability: float):
        """Notify user when business durability drops below 10%"""
        msg = f"""🚨 <b>КРИТИЧЕСКИЙ ИЗНОС!</b>

🏢 <b>{business_name}</b>
📉 Прочность: <b>{durability:.1f}%</b>

⚠️ Бизнес в критическом состоянии!
<b>Срочно проведите ремонт!</b>

🔧 Откройте TON City → "Мои бизнесы" → Ремонт"""
        
        return await self.notify_user(user_id, msg)
    
    async def notify_business_stopped(self, user_id: str, business_name: str):
        """Notify user when business stops due to 0% durability"""
        msg = f"""🛑 <b>БИЗНЕС ПРИОСТАНОВЛЕН</b>

🏢 <b>{business_name}</b>
📉 Прочность: <b>0%</b>

❌ Производство полностью остановлено!
Для возобновления работы необходим <b>полный ремонт</b>."""
        
        return await self.notify_user(user_id, msg)
    
    async def notify_deposit(self, user_id: str, amount: float, tx_hash: str):
        """Notify user about successful deposit"""
        msg = f"""💰 <b>Пополнение баланса</b>

✅ Зачислено: <b>+{amount:.4f} TON</b>

🔗 TX: <code>{tx_hash[:20]}...</code>"""
        
        return await self.notify_user(user_id, msg)
    
    async def notify_withdrawal_approved(self, user_id: str, amount: float, tx_hash: str):
        """Notify user about approved withdrawal"""
        msg = f"""✅ <b>Вывод одобрен</b>

💸 Отправлено: <b>{amount:.4f} TON</b>

🔗 TX: <code>{tx_hash[:20]}...</code>"""
        
        return await self.notify_user(user_id, msg)
    
    async def notify_withdrawal_rejected(self, user_id: str, amount: float, reason: str = ""):
        """Notify user about rejected withdrawal"""
        msg = f"""❌ <b>Вывод отклонён</b>

💰 Сумма: <b>{amount:.4f} TON</b> возвращена на баланс.

{f'Причина: {reason}' if reason else 'Обратитесь в поддержку для уточнения.'}"""
        
        return await self.notify_user(user_id, msg)
    
    async def notify_admin_new_withdrawal(self, tx_data: Dict):
        """Notify admin about new withdrawal request with action buttons"""
        admin_id = await self.get_admin_telegram_id()
        if not admin_id:
            logger.warning("Admin telegram ID not configured for withdrawal notification")
            return False
        
        tx_id = tx_data.get("id", "")
        amount = tx_data.get("amount_ton", abs(tx_data.get("amount", 0)))
        net_amount = tx_data.get("net_amount", amount)
        commission = tx_data.get("commission", 0)
        
        # Полный адрес в friendly формате
        raw_addr = tx_data.get('user_wallet') or tx_data.get('to_address') or '?'
        full_address = tx_data.get('to_address_display') or self._to_friendly_address(raw_addr)
        
        msg = f"""🔔 <b>НОВАЯ ЗАЯВКА НА ВЫВОД</b>

👤 Пользователь: <b>{tx_data.get('user_username', 'Unknown')}</b>
💰 Сумма: <b>{amount:.4f} TON</b>
💸 К выплате: <b>{net_amount:.4f} TON</b>
📊 Комиссия: <b>{commission:.4f} TON</b>

📍 Адрес: <code>{full_address}</code>
📅 {tx_data.get('created_at', '')[:16]}"""
        
        reply_markup = {
            "inline_keyboard": [
                [
                    {"text": "✅ Одобрить", "callback_data": f"approve_wd_{tx_id}"},
                    {"text": "❌ Отклонить", "callback_data": f"reject_wd_{tx_id}"}
                ]
            ]
        }
        
        return await self.send_message(admin_id, msg, reply_markup=reply_markup)
    
    async def setup_webhook(self, webhook_url: str) -> Dict:
        """Setup telegram webhook automatically"""
        bot_token = await self.get_bot_token()
        if not bot_token:
            return {"success": False, "error": "Bot token not configured"}
        
        try:
            async with aiohttp.ClientSession() as client:
                # Delete existing webhook
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/deleteWebhook",
                    timeout=aiohttp.ClientTimeout(total=10)
                )
                
                # Set new webhook
                response = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/setWebhook",
                    json={"url": webhook_url},
                    timeout=aiohttp.ClientTimeout(total=10)
                )
                
                if response.status == 200:
                    data = await response.json()
                    if data.get("ok"):
                        logger.info(f"✅ Telegram webhook set to: {webhook_url}")
                        return {"success": True, "url": webhook_url}
                    else:
                        return {"success": False, "error": data.get("description", "Unknown error")}
                else:
                    return {"success": False, "error": f"HTTP {response.status}"}
                    
        except Exception as e:
            logger.error(f"Setup webhook error: {e}")
            return {"success": False, "error": str(e)}


# Global bot instance
telegram_bot: Optional[TelegramBot] = None

async def init_telegram_bot(db) -> TelegramBot:
    """Initialize telegram bot"""
    global telegram_bot
    telegram_bot = TelegramBot(db)
    logger.info("✅ Telegram bot initialized")
    return telegram_bot

def get_telegram_bot() -> Optional[TelegramBot]:
    """Get telegram bot instance"""
    return telegram_bot
