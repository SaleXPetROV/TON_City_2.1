"""
Withdrawal routes module
Handles all withdrawal-related endpoints with 2FA protection
"""
import uuid
import pyotp
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from core.dependencies import get_current_user
from core.models import User, WithdrawRequest, InstantWithdrawRequest
from core.helpers import get_user_identifiers, get_user_filter
from game_systems import BankingSystem

logger = logging.getLogger(__name__)


def create_withdrawal_router(db):
    """Create withdrawal routes with database access"""
    
    router = APIRouter(prefix="/api", tags=["withdrawal"])
    
    @router.get("/banks")
    async def get_banks():
        """Get banks available for instant withdrawal"""
        banks = await db.businesses.find(
            {"business_type": {"$in": ["gram_bank", "dex", "bank"]}},
            {"_id": 0}
        ).to_list(50)
        return {"banks": banks}
    
    @router.post("/withdraw/instant")
    async def instant_withdrawal(
        data: InstantWithdrawRequest,
        current_user: User = Depends(get_current_user)
    ):
        """Create instant withdrawal via bank"""
        bank_id = data.bank_id
        amount = data.amount
        totp_code = data.totp_code
        
        # Get user
        user = await db.users.find_one(
            {"$or": [{"id": current_user.id}, {"wallet_address": current_user.wallet_address}]},
            {"_id": 0}
        )
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Check 2FA - REQUIRED for withdrawal
        totp_secret = user.get("two_factor_secret") or user.get("totp_secret")
        is_2fa_enabled = user.get("is_2fa_enabled", False)
        has_passkey = bool(user.get("passkeys") and len(user.get("passkeys", [])) > 0)
        
        if not is_2fa_enabled and not has_passkey:
            raise HTTPException(status_code=403, detail="Для вывода средств необходимо включить 2FA аутентификацию в настройках безопасности")
        
        # Verify 2FA code if user has TOTP enabled
        if is_2fa_enabled and totp_secret:
            if not totp_code:
                raise HTTPException(status_code=400, detail="Требуется код 2FA для мгновенного вывода")
            
            # Verify TOTP
            totp = pyotp.TOTP(totp_secret)
            
            if not totp.verify(totp_code.strip(), valid_window=3):
                raise HTTPException(status_code=400, detail="Неверный код 2FA")
        
        # Check balance
        if user.get("balance_ton", 0) < amount:
            raise HTTPException(status_code=400, detail="Недостаточно средств")
        
        # Get bank
        bank = await db.businesses.find_one({"id": bank_id}, {"_id": 0})
        if not bank or bank.get("business_type") not in ["gram_bank", "dex", "bank"]:
            raise HTTPException(status_code=404, detail="Банк не найден")
        
        # Check bank can process
        can_process, reason = BankingSystem.can_process_instant(bank, amount)
        if not can_process:
            raise HTTPException(status_code=400, detail=reason)
        
        user_id = user.get("id", str(user.get("_id")))
        
        # Create withdrawal
        withdrawal = BankingSystem.create_withdrawal_request(
            user_id,
            amount,
            "instant"
        )
        withdrawal["bank_id"] = bank_id
        withdrawal["bank_owner"] = bank.get("owner")
        withdrawal["type"] = "withdrawal"
        withdrawal["amount"] = -amount
        withdrawal["description"] = f"Мгновенный вывод {amount} TON через банк"
        
        # Calculate fees
        PLATFORM_FEE = 0.03
        platform_commission = amount * PLATFORM_FEE
        bank_fee = withdrawal["bank_fee"]
        net_amount = withdrawal["net_amount"]
        
        # Deduct from user balance
        user_filter = get_user_filter(user)
        await db.users.update_one(user_filter, {"$inc": {"balance_ton": -amount}})
        
        # Store withdrawal
        withdrawal_doc = {
            **withdrawal, 
            "tx_type": "instant_withdrawal",
            "user_wallet": user.get("wallet_address"),
            "user_id": user_id
        }
        await db.transactions.insert_one(withdrawal_doc)
        
        logger.info(f"✅ Instant withdrawal created: {amount} TON for user {user_id}")
        
        return {
            "status": "processing",
            "withdrawal_id": withdrawal["id"],
            "type": "instant",
            "amount": amount,
            "net_amount": withdrawal["net_amount"],
            "bank_fee": bank_fee,
            "platform_commission": withdrawal["platform_commission"],
            "new_balance": user.get("balance_ton", 0) - amount
        }
    
    @router.get("/withdrawals/queue")
    async def get_withdrawal_queue(current_user: User = Depends(get_current_user)):
        """Get user's withdrawal queue"""
        withdrawals = await db.transactions.find(
            {
                "user_id": current_user.id,
                "tx_type": {"$in": ["withdrawal", "instant_withdrawal"]}
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(20)
        return {"withdrawals": withdrawals}
    
    @router.post("/withdraw")
    async def create_withdraw(
        data: WithdrawRequest,
        current_user: User = Depends(get_current_user)
    ):
        """Create standard withdrawal request with 2FA protection"""
        # Get user
        user = await db.users.find_one(
            {"$or": [{"id": current_user.id}, {"wallet_address": current_user.wallet_address}]},
            {"_id": 0}
        )
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Check 2FA - REQUIRED for withdrawal
        totp_secret = user.get("two_factor_secret") or user.get("totp_secret")
        is_2fa_enabled = user.get("is_2fa_enabled", False)
        has_passkey = bool(user.get("passkeys") and len(user.get("passkeys", [])) > 0)
        
        if not is_2fa_enabled and not has_passkey:
            raise HTTPException(status_code=403, detail="Для вывода средств необходимо включить 2FA аутентификацию в настройках безопасности")
        
        # Verify 2FA code if user has TOTP enabled
        if is_2fa_enabled and totp_secret:
            if not data.totp_code:
                raise HTTPException(status_code=400, detail="Требуется код 2FA для вывода средств")
            
            # Verify TOTP
            totp = pyotp.TOTP(totp_secret)
            
            if not totp.verify(data.totp_code.strip() if data.totp_code else "", valid_window=3):
                raise HTTPException(status_code=400, detail="Неверный код 2FA")
        
        # Check wallet
        wallet = user.get("wallet_address")
        if not wallet:
            raise HTTPException(status_code=400, detail="Подключите кошелёк для вывода средств")
        
        # Check balance
        if user.get("balance_ton", 0) < data.amount:
            raise HTTPException(status_code=400, detail="Недостаточно средств")
        
        # Check minimum
        MIN_WITHDRAWAL = 1.0
        if data.amount < MIN_WITHDRAWAL:
            raise HTTPException(status_code=400, detail=f"Минимальная сумма вывода: {MIN_WITHDRAWAL} TON")
        
        user_id = user.get("id", str(user.get("_id")))
        
        # Create withdrawal
        WITHDRAWAL_FEE = 0.03
        fee = data.amount * WITHDRAWAL_FEE
        net_amount = data.amount - fee
        
        withdrawal = {
            "id": str(uuid.uuid4()),
            "type": "withdrawal",
            "tx_type": "withdrawal",
            "user_id": user_id,
            "user_wallet": wallet,
            "amount": data.amount,
            "amount_ton": -data.amount,
            "fee": fee,
            "net_amount": net_amount,
            "to_address": wallet,
            "to_address_raw": user.get("raw_address", wallet),
            "status": "pending",
            "description": f"Вывод {data.amount} TON",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Deduct from balance
        user_filter = get_user_filter(user)
        await db.users.update_one(user_filter, {"$inc": {"balance_ton": -data.amount}})
        
        # Store withdrawal
        await db.transactions.insert_one({**withdrawal, "tx_type": "withdrawal"})
        
        logger.info(f"✅ Withdrawal created: {data.amount} TON for user {user_id}")
        
        return {
            "status": "pending",
            "withdrawal_id": withdrawal["id"],
            "net_amount": net_amount,
            "to_address": wallet,
            "to_address_raw": user.get("raw_address", wallet),
            "new_balance": user.get("balance_ton", 0) - data.amount
        }
    
    return router
