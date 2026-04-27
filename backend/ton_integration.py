"""
TON Blockchain Integration Module
Handles real TON mainnet transactions
"""
import os
import asyncio
import logging
from typing import Optional, Dict
from tonsdk.contract.wallet import WalletVersionEnum, Wallets
from tonsdk.utils import bytes_to_b64str, to_nano
import base64
import json
import httpx

logger = logging.getLogger(__name__)

# TON Configuration
TON_MAINNET_CONFIG = "https://ton.org/global-config.json"
TON_TESTNET = False  # Set to False for mainnet

class TONClient:
    def __init__(self):
        self.initialized = False
        
    async def init(self):
        if self.initialized: return
        try:
            # Инициализация клиента (для работы send_ton_payout)
            self.initialized = True
            logger.info("✅ TON Client initialized for transfers")
        except Exception as e:
            logger.error(f"❌ Failed to init: {e}")

    async def send_ton_payout(self, dest_address: str, amount_ton: float, mnemonics: str, user_username: str = ""):
        """Отправка TON через API Toncenter с автоопределением версии кошелька"""
        try:
            api_key = os.environ.get("TONCENTER_API_KEY") or ""
            toncenter_endpoint = os.environ.get("TONCENTER_API_ENDPOINT", "https://toncenter.com/api/v2").rstrip('/')
            
            from tonsdk.crypto import mnemonic_to_wallet_key
            from tonsdk.contract.wallet import WalletV4ContractR2, WalletV3ContractR2
            
            mnemonics_list = mnemonics.strip().split()
            if len(mnemonics_list) != 24:
                raise Exception(f"Неверное количество слов в мнемонике: {len(mnemonics_list)} (нужно 24)")
            
            pub_k, priv_k = mnemonic_to_wallet_key(mnemonics_list)
            
            # Создаём оба варианта кошельков
            wallet_v4 = WalletV4ContractR2(public_key=pub_k, private_key=priv_k, workchain=0)
            wallet_v3 = WalletV3ContractR2(public_key=pub_k, private_key=priv_k, workchain=0)
            
            addr_v4 = wallet_v4.address.to_string(True, True, False)
            addr_v3 = wallet_v3.address.to_string(True, True, False)
            
            logger.info(f"📢 V4R2 адрес: {addr_v4}")
            logger.info(f"📢 V3R2 адрес: {addr_v3}")
            
            # Проверяем какой из адресов активен
            _wallet = None
            wallet_address = None
            
            # Helper function for API calls with retry
            async def api_call_with_retry(client, url, params, headers, max_retries=3):
                for attempt in range(max_retries):
                    resp = await client.get(url, params=params, headers=headers)
                    if resp.status_code == 429:
                        logger.warning(f"⚠️ Rate limited (429), retry {attempt + 1}/{max_retries}...")
                        await asyncio.sleep(1 + attempt)  # Progressive delay
                        continue
                    return resp.json()
                return {"result": {}}  # Return empty on failure
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                headers = {"X-API-Key": api_key} if api_key else {}
                
                # Проверяем V4R2 с retry
                resp_v4_json = await api_call_with_retry(
                    client, f"{toncenter_endpoint}/getWalletInformation",
                    {"address": addr_v4}, headers
                )
                data_v4 = resp_v4_json.get("result", {}) if isinstance(resp_v4_json, dict) else {}
                if not isinstance(data_v4, dict):
                    data_v4 = {}
                state_v4 = data_v4.get("account_state", "")
                balance_v4 = int(data_v4.get("balance", 0)) / 1e9
                
                # Проверяем V3R2 с retry
                resp_v3_json = await api_call_with_retry(
                    client, f"{toncenter_endpoint}/getWalletInformation",
                    {"address": addr_v3}, headers
                )
                data_v3 = resp_v3_json.get("result", {}) if isinstance(resp_v3_json, dict) else {}
                if not isinstance(data_v3, dict):
                    data_v3 = {}
                state_v3 = data_v3.get("account_state", "")
                balance_v3 = int(data_v3.get("balance", 0)) / 1e9
                
                logger.info(f"📊 V4R2: state={state_v4}, balance={balance_v4}")
                logger.info(f"📊 V3R2: state={state_v3}, balance={balance_v3}")
                
                # Выбираем активный кошелёк с балансом
                if state_v4 == "active" and balance_v4 >= amount_ton + 0.01:
                    _wallet = wallet_v4
                    wallet_address = addr_v4
                    result = data_v4
                    logger.info("✅ Используем V4R2")
                elif state_v3 == "active" and balance_v3 >= amount_ton + 0.01:
                    _wallet = wallet_v3
                    wallet_address = addr_v3
                    result = data_v3
                    logger.info("✅ Используем V3R2")
                elif balance_v4 > 0:
                    _wallet = wallet_v4
                    wallet_address = addr_v4
                    result = data_v4
                    logger.info("⚠️ Пробуем V4R2 (есть баланс)")
                elif balance_v3 > 0:
                    _wallet = wallet_v3
                    wallet_address = addr_v3
                    result = data_v3
                    logger.info("⚠️ Пробуем V3R2 (есть баланс)")
                else:
                    raise Exception(f"Оба кошелька неактивны или пусты.\nV4R2: {addr_v4} (баланс: {balance_v4})\nV3R2: {addr_v3} (баланс: {balance_v3})\nПополните один из них.")
                
                # Проверка баланса
                balance = int(result.get("balance", 0)) / 1e9
                if balance < amount_ton + 0.01:
                    raise Exception(f"Недостаточно средств. Баланс: {balance:.4f} TON, нужно: {amount_ton + 0.01:.4f} TON")
                
                seqno = result.get("seqno", 0) or 0
                logger.info(f"📊 Используем адрес: {wallet_address}, seqno={seqno}")

            # Создаем сообщение о переводе с комментарием
            comment_text = f"TON City Entertainment @{user_username}" if user_username else "TON City Entertainment"
            
            # Создаём payload с комментарием
            from tonsdk.boc import Cell
            from tonsdk.utils import bytes_to_b64str as _b2b
            
            comment_cell = Cell()
            comment_cell.bits.write_uint(0, 32)  # op = 0 for simple text comment
            comment_cell.bits.write_string(comment_text)
            
            query = _wallet.create_transfer_message(
                to_addr=dest_address,
                amount=to_nano(amount_ton, 'ton'),
                seqno=int(seqno),
                payload=comment_cell
            )

            # 5. Отправляем BOC в сеть
            boc = bytes_to_b64str(query['message'].to_boc(False))
            
            # Retry logic for sendBoc
            max_retries = 3
            retry_delay = 2
            last_error = None
            
            for attempt in range(max_retries):
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(f"{toncenter_endpoint}/sendBoc", json={"boc": boc}, headers=headers)
                    res_data = resp.json()
                    
                    if resp.status_code == 200 and res_data.get("ok"):
                        tx_hash = res_data.get("result", {}).get("hash") or "sent_success"
                        logger.info(f"✅ УСПЕХ! Хэш: {tx_hash}")
                        return tx_hash
                    elif resp.status_code == 429:
                        # Rate limited - wait and retry
                        logger.warning(f"⚠️ Rate limited (429), attempt {attempt + 1}/{max_retries}, waiting {retry_delay}s...")
                        last_error = "Rate limit exceeded. Слишком много запросов к сети TON."
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        continue
                    else:
                        error_msg = res_data.get("error", "Unknown blockchain error")
                        logger.error(f"❌ Сеть отклонила BOC: {error_msg}")
                        
                        # Более понятные сообщения об ошибках
                        if "unpack account state" in str(error_msg).lower():
                            raise Exception("Кошелёк отправителя не активирован или пуст. Пополните его TON и повторите.")
                        elif "not enough" in str(error_msg).lower():
                            raise Exception("Недостаточно средств на кошельке отправителя.")
                        elif "seqno" in str(error_msg).lower():
                            raise Exception("Ошибка последовательности транзакции. Попробуйте позже.")
                        else:
                            raise Exception(f"Ошибка сети TON: {error_msg}")
            
            # All retries exhausted
            raise Exception(last_error or "Превышен лимит запросов к TON API. Добавьте TONCENTER_API_KEY для увеличения лимитов.")

        except Exception as e:
            logger.error(f"❌ Критическая ошибка в send_ton_payout: {e}")
            raise e

    async def get_transaction_history(self, address: str, limit: int = 20):
        """Получение истории для payment_monitor.py"""
        try:
            import httpx
            # Используем публичное API Toncenter
            url = f"https://toncenter.com/api/v2/getTransactions?address={address}&limit={limit}"
            async with httpx.AsyncClient() as client:
                r = await client.get(url)
                data = r.json()
                return data.get("result", [])
        except Exception as e:
            logger.error(f"Failed to fetch history: {e}")
            return []

    async def check_incoming_transactions(self):
        try:
            settings = await self.get_game_settings()
            receiver_address = settings.get("receiver_address")
            if not receiver_address: return

            # Получаем историю транзакций кошелька проекта
            transactions = await ton_client.get_transaction_history(receiver_address)
            
            for tx in transactions:
                # 1. Проверяем, не обрабатывали ли мы этот tx_hash раньше
                # 2. Ищем в комментарии (payload) ID пользователя
                # 3. Если нашли, вызываем:
                # await self.process_payment(user_id, amount, tx_hash)
                pass
        except Exception as e:
            logger.error(f"Error in monitor: {e}")

# Global TON client instance
ton_client = TONClient()

async def init_ton_client():
    """Initialize TON client on startup"""
    await ton_client.init()

async def close_ton_client():
    """Close TON client on shutdown"""
    await ton_client.close()

# Helper functions
def ton_to_nano(amount: float) -> int:
    """Convert TON to nanoTON"""
    return int(amount * 1e9)

def nano_to_ton(amount: int) -> float:
    """Convert nanoTON to TON"""
    return amount / 1e9

def validate_ton_address(address: str) -> bool:
    """
    Validate TON address format
    
    Args:
        address: TON wallet address
        
    Returns:
        True if valid
    """
    # TON addresses are typically 48 characters
    # Format: EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    if not address:
        return False
    
    if len(address) != 48:
        return False
    
    if not address.startswith(('EQ', 'UQ')):
        return False
    
    return True
