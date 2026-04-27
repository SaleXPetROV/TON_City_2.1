"""
TON Payment Monitor
Monitors incoming TON transactions and credits internal balance
"""
import logging
import asyncio
import uuid
from datetime import datetime, timezone
import os   
from tonsdk.utils import Address

def to_raw(address_str):
    try:
        return Address(address_str).to_string(is_user_friendly=False)
    except Exception:
        return address_str


logger = logging.getLogger(__name__)

class TONPaymentMonitor:
    """Monitor TON blockchain for incoming payments"""
    
    def __init__(self, db):
        self.db = db
        self.is_running = False
        self.check_interval = 30  # seconds
        
    async def get_game_settings(self):
        """Get game wallet settings from database"""
        settings = await self.db.game_settings.find_one({"type": "ton_wallet"})
        if not settings:
            # Create default settings
            default_settings = {
                "type": "ton_wallet",
                "network": "testnet",  # testnet or mainnet
                "receiver_address": "",  # Admin sets this
                "last_checked_lt": 0,  # Logical time for transaction tracking
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await self.db.game_settings.insert_one(default_settings)
            settings = default_settings
        
        # PRIORITY 1: Check distribution smart contract address first
        contract_settings = await self.db.admin_settings.find_one({"type": "distribution_contract"}, {"_id": 0})
        if contract_settings and contract_settings.get("contract_address"):
            settings["receiver_address"] = contract_settings.get("contract_address")
            return settings
        
        # PRIORITY 2: Check admin_wallets if receiver_address is empty
        if not settings.get("receiver_address"):
            admin_wallet = await self.db.admin_wallets.find_one({}, {"_id": 0})
            if admin_wallet and admin_wallet.get("address"):
                settings["receiver_address"] = admin_wallet.get("address")
        
        return settings
    
    async def check_incoming_transactions(self):
        """Check for new incoming TON transactions"""
        try:
            settings = await self.get_game_settings()
            receiver_address = settings.get("receiver_address")
            
            if not receiver_address:
                logger.warning("⚠️ Адрес получателя не настроен.")
                return
            
            from ton_integration import ton_client
            # Ton APIs may return sender/receiver in raw (0:...) format; keep both forms available.
            receiver_raw = to_raw(receiver_address)

            # Some providers expect user-friendly, some expect raw. Try user-friendly first, then raw.
            try:
                transactions = await ton_client.get_transaction_history(receiver_address, limit=20)
            except Exception:
                transactions = await ton_client.get_transaction_history(receiver_raw, limit=20)
            
            for tx in transactions:
                # Проверка что tx это словарь
                if not isinstance(tx, dict):
                    logger.warning(f"Unexpected tx format: {type(tx)}")
                    continue
                    
                tx_hash = tx.get("transaction_id", {}).get("hash")
                in_msg = tx.get("in_msg", {})
                
                sender_address = in_msg.get("source") # Адрес кошелька плательщика (often raw: 0:...)
                value = int(in_msg.get("value", 0))    # Сумма в нанотоннах

                if value <= 0 or not sender_address:
                    continue

                sender_raw = to_raw(sender_address)
                user = await self.db.users.find_one({
                    "$or": [
                        {"wallet_address": sender_address},
                        {"raw_address": sender_address},
                        {"wallet_address": sender_raw},
                        {"raw_address": sender_raw},
                    ]
                }, {"_id": 0})

                if user:
                    # 3. Формируем данные для зачисления
                    tx_data = {
                        "hash": tx_hash,
                        "sender": sender_address,
                        "sender_raw": sender_raw,
                        "amount": value,
                        "utime": tx.get("utime", 0)  # Transaction timestamp
                    }
                    # Зачисляем деньги пользователю
                    await self.process_incoming_payment(tx_data)
                else:
                    # Если кошелек не найден в базе
                    logger.debug(f"Платеж от неизвестного адреса: {sender_address}")

        except Exception as e:
            logger.error(f"❌ Error in monitor: {e}")
    
    async def process_incoming_payment(self, transaction):
        """
        Process an incoming TON payment
        
        Args:
            transaction: Transaction data from blockchain
        """
        try:
            tx_hash = transaction.get("hash")
            sender = transaction.get("sender")
            sender_raw = transaction.get("sender_raw") or to_raw(sender)
            amount = transaction.get("amount", 0)
            amount_ton = amount / 1_000_000_000  # Convert from nanotons
            tx_utime = transaction.get("utime", 0)  # Transaction timestamp
            
            # Find user by wallet address
            user = await self.db.users.find_one({
                "$or": [
                    {"wallet_address": sender},
                    {"raw_address": sender},
                    {"wallet_address": sender_raw},
                    {"raw_address": sender_raw},
                ]
            })
            
            if not user:
                logger.warning(f"⚠️  Payment from unknown user: {sender}")
                # Create pending deposit
                await self.db.deposits.insert_one({
                    "tx_hash": tx_hash,
                    "sender": sender,
                    "sender_raw": sender_raw,
                    "amount_ton": amount_ton,
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                return
            
            # Check if already processed
            existing = await self.db.deposits.find_one({"tx_hash": tx_hash})
            if existing:
                logger.debug(f"Transaction {tx_hash} already processed")
                return
            
            # PROBLEM #4 FIX: Check if transaction is AFTER wallet was linked
            # This prevents crediting old transactions when reconnecting wallet
            wallet_linked_at = user.get("wallet_linked_at")
            if wallet_linked_at and tx_utime > 0:
                from dateutil import parser as date_parser
                try:
                    linked_time = date_parser.isoparse(wallet_linked_at)
                    tx_time = datetime.fromtimestamp(tx_utime, tz=timezone.utc)
                    
                    if tx_time < linked_time:
                        logger.info(f"⏭️ Skipping old transaction from {tx_time} (wallet linked at {linked_time})")
                        # Record as skipped so we don't check it again
                        await self.db.deposits.insert_one({
                            "tx_hash": tx_hash,
                            "sender": sender,
                            "sender_raw": sender_raw,
                            "amount_ton": amount_ton,
                            "status": "skipped_old",
                            "reason": "Transaction before wallet_linked_at",
                            "tx_time": tx_time.isoformat(),
                            "linked_time": linked_time.isoformat(),
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                        return
                except Exception as parse_err:
                    logger.warning(f"Could not parse dates: {parse_err}")
            
            # Also check last_deposit_processed_at for the user
            last_processed = user.get("last_deposit_processed_at")
            if last_processed and tx_utime > 0:
                from dateutil import parser as date_parser
                try:
                    last_time = date_parser.isoparse(last_processed)
                    tx_time = datetime.fromtimestamp(tx_utime, tz=timezone.utc)
                    
                    if tx_time < last_time:
                        logger.debug(f"Skipping already processed transaction from {tx_time}")
                        return
                except Exception:
                    pass
            
            user_id = user.get("id", str(user["_id"]))
            
            # Credit user balance and update last_deposit_processed_at
            current_time = datetime.now(timezone.utc).isoformat()
            await self.db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$inc": {
                        "balance_ton": amount_ton,
                        "total_deposited": amount_ton
                    },
                    "$set": {
                        "last_deposit_processed_at": current_time
                    }
                }
            )
            
            # Record deposit
            deposit_id = str(uuid.uuid4())
            await self.db.deposits.insert_one({
                "id": deposit_id,
                "tx_hash": tx_hash,
                "user_id": user_id,
                "wallet_address": user.get("wallet_address"),
                "raw_address": user.get("raw_address"),
                "amount_ton": amount_ton,
                "status": "completed",
                "credited_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            # ===== ЗАПИСЫВАЕМ В ИСТОРИЮ ТРАНЗАКЦИЙ =====
            transaction_record = {
                "id": str(uuid.uuid4()),
                "type": "deposit",
                "tx_type": "deposit",
                "user_id": user_id,
                "user_username": user.get("username"),
                "user_wallet": user.get("wallet_address"),
                "amount": amount_ton,  # Положительное для пополнения
                "amount_ton": amount_ton,
                "from_address": sender,
                "to_address": user.get("wallet_address"),
                "description": f"Пополнение баланса +{amount_ton:.4f} TON",
                "status": "completed",
                "blockchain_hash": tx_hash,
                "deposit_id": deposit_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
            await self.db.transactions.insert_one(transaction_record)
            
            # Update stats
            await self.db.admin_stats.update_one(
                {"type": "treasury"},
                {
                    "$inc": {
                        "total_deposits": amount_ton,
                        "deposits_count": 1
                    }
                },
                upsert=True
            )
            
            # ===== РАЗДЕЛЕНИЕ СРЕДСТВ НА КОШЕЛЬКИ АДМИНИСТРАТОРОВ =====
            await self.distribute_deposit_to_wallets(amount_ton, tx_hash, user_id)
            
            # ===== TELEGRAM УВЕДОМЛЕНИЕ ПОЛЬЗОВАТЕЛЮ =====
            try:
                from telegram_bot import get_telegram_bot
                bot = get_telegram_bot()
                if bot:
                    await bot.notify_deposit(user_id, amount_ton, tx_hash)
            except Exception as tg_err:
                logger.warning(f"Failed to send telegram notification: {tg_err}")
            
            logger.info(f"✅ Credited {amount_ton} TON to {user.get('username', 'User')}")
            logger.info(f"   TX: {tx_hash}")
            
        except Exception as e:
            logger.error(f"❌ Error processing payment: {e}")
    
    async def distribute_deposit_to_wallets(self, amount_ton: float, tx_hash: str, user_id: str):
        """
        Разделить входящий депозит между кошельками админов согласно процентам
        И автоматически отправить TON на эти кошельки
        """
        try:
            # Получаем настроенные кошельки
            wallets = await self.db.admin_wallets.find({}, {"_id": 0}).to_list(100)
            
            if not wallets:
                logger.debug("Нет настроенных кошельков для распределения")
                return
            
            # Вычисляем общий процент
            total_percentage = sum(w.get("percentage", 0) for w in wallets)
            if total_percentage <= 0:
                return
            
            # Получаем мнемонику отправителя для автоматических переводов
            sender_wallet = await self.db.admin_settings.find_one({"type": "sender_wallet"}, {"_id": 0})
            mnemonic = sender_wallet.get("mnemonic") if sender_wallet else None
            if not mnemonic:
                mnemonic = os.environ.get("TON_WALLET_MNEMONIC")
            
            from ton_integration import ton_client
            
            for wallet in wallets:
                percentage = wallet.get("percentage", 0)
                if percentage <= 0:
                    continue
                
                # Сумма для этого кошелька
                wallet_amount = amount_ton * (percentage / 100)
                wallet_address = wallet.get("address")
                
                if wallet_amount > 0 and wallet_address:
                    distribution_id = str(uuid.uuid4())
                    
                    # Записываем в лог распределения
                    distribution_record = {
                        "id": distribution_id,
                        "original_tx_hash": tx_hash,
                        "user_id": user_id,
                        "wallet_address": wallet_address,
                        "amount": wallet_amount,
                        "percentage": percentage,
                        "status": "pending",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await self.db.deposit_distributions.insert_one(distribution_record)
                    
                    # Автоматическая отправка TON если есть мнемоника
                    if mnemonic and wallet_amount >= 0.01:  # Минимум 0.01 TON для перевода
                        try:
                            dist_tx_hash = await ton_client.send_ton_payout(
                                dest_address=wallet_address,
                                amount_ton=wallet_amount,
                                mnemonics=mnemonic
                            )
                            
                            # Обновляем статус на completed
                            await self.db.deposit_distributions.update_one(
                                {"id": distribution_id},
                                {"$set": {
                                    "status": "completed",
                                    "tx_hash": dist_tx_hash,
                                    "completed_at": datetime.now(timezone.utc).isoformat()
                                }}
                            )
                            
                            logger.info(f"✅ Автоматически отправлено {wallet_amount:.4f} TON ({percentage}%) на {wallet_address[:12]}... TX: {dist_tx_hash[:20]}")
                            
                        except Exception as send_err:
                            logger.warning(f"⚠️ Не удалось автоматически отправить на {wallet_address[:12]}...: {send_err}")
                            # Статус остаётся pending для ручной обработки
                    else:
                        logger.info(f"📊 Распределено {wallet_amount:.4f} TON ({percentage}%) на {wallet_address[:12]}... (требуется ручной перевод)")
            
        except Exception as e:
            logger.error(f"❌ Error distributing deposit: {e}")
    
    async def start_monitoring(self):
        """Start monitoring loop"""
        self.is_running = True
        logger.info("🚀 TON Payment Monitor started")
        
        while self.is_running:
            try:
                await self.check_incoming_transactions()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"❌ Monitor error: {e}")
                await asyncio.sleep(self.check_interval)
    
    async def stop_monitoring(self):
        """Stop monitoring loop"""
        self.is_running = False
        logger.info("🛑 TON Payment Monitor stopped")


# Global monitor instance
payment_monitor = None

async def init_payment_monitor(db):
    """Initialize payment monitor"""
    global payment_monitor
    payment_monitor = TONPaymentMonitor(db)
    # Start in background
    asyncio.create_task(payment_monitor.start_monitoring())
    logger.info("✅ Payment monitor initialized")

async def stop_payment_monitor():
    """Stop payment monitor"""
    global payment_monitor
    if payment_monitor:
        await payment_monitor.stop_monitoring()
