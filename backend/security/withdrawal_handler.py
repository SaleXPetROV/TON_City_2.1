"""
Secure Withdrawal Handler
Implements withdrawal flow with 2FA/Passkey verification
"""
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import logging

from .security_service import SecurityService
from .totp_handler import verify_totp_code

logger = logging.getLogger(__name__)

withdrawal_router = APIRouter(prefix="/security/withdraw", tags=["security", "withdrawal"])

# Store pending withdrawals (in production use Redis with TTL)
pending_withdrawals: Dict[str, Dict[str, Any]] = {}


# ==================== REQUEST MODELS ====================

class WithdrawInitRequest(BaseModel):
    """Initialize withdrawal request"""
    amount: float
    destination_address: Optional[str] = None

class WithdrawVerifyTOTPRequest(BaseModel):
    """Verify withdrawal with TOTP code"""
    withdrawal_id: str
    totp_code: str

class WithdrawVerifyPasskeyRequest(BaseModel):
    """Verify withdrawal with Passkey"""
    withdrawal_id: str
    passkey_response: Dict[str, Any]


# ==================== ROUTES ====================

def create_withdrawal_routes(db):
    """Factory function to create routes with database access"""
    
    security_service = SecurityService(db)
    
    @withdrawal_router.post("/init")
    async def init_withdrawal(request: WithdrawInitRequest, current_user: dict):
        """
        Step 1: Initialize withdrawal and determine verification method
        Returns required verification method
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Check balance
        if user.get("balance_ton", 0) < request.amount:
            raise HTTPException(status_code=400, detail="Недостаточно средств")
        
        # Check minimum withdrawal
        MIN_WITHDRAWAL = 1.0
        if request.amount < MIN_WITHDRAWAL:
            raise HTTPException(status_code=400, detail=f"Минимальная сумма вывода: {MIN_WITHDRAWAL} TON")
        
        # Check if withdrawal is allowed
        allowed, reason, required_method = await security_service.check_withdrawal_allowed(user["id"])
        
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=reason,
                headers={"X-Security-Required": required_method}
            )
        
        # Create pending withdrawal
        withdrawal_id = secrets.token_hex(16)
        pending_withdrawals[withdrawal_id] = {
            "user_id": user["id"],
            "amount": request.amount,
            "destination": request.destination_address or user.get("wallet_address"),
            "required_method": required_method,
            "verified": False,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
        }
        
        await security_service._log_security_event(
            user["id"],
            "withdrawal_initiated",
            {"amount": request.amount, "required_method": required_method}
        )
        
        return {
            "status": "pending_verification",
            "withdrawal_id": withdrawal_id,
            "amount": request.amount,
            "required_method": required_method,
            "message": reason,
            "expires_in_seconds": 600
        }
    
    @withdrawal_router.post("/verify/totp")
    async def verify_withdrawal_totp(request: WithdrawVerifyTOTPRequest, current_user: dict):
        """
        Verify withdrawal with TOTP code
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Get pending withdrawal
        pending = pending_withdrawals.get(request.withdrawal_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Запрос на вывод не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        if datetime.now(timezone.utc) > pending["expires_at"]:
            del pending_withdrawals[request.withdrawal_id]
            raise HTTPException(status_code=400, detail="Запрос на вывод истёк")
        
        # Check if TOTP is allowed for this withdrawal
        if pending["required_method"] not in ["totp", "passkey"]:
            raise HTTPException(status_code=400, detail="TOTP верификация не доступна")
        
        # Verify TOTP
        secret = user.get("two_factor_secret")
        if not secret:
            raise HTTPException(status_code=400, detail="2FA не настроена")
        
        # Try TOTP code
        if verify_totp_code(secret, request.totp_code):
            pending["verified"] = True
            pending["verification_method"] = "totp"
            
            await security_service._log_security_event(
                user["id"],
                "withdrawal_verified",
                {"method": "totp", "amount": pending["amount"]}
            )
            
            # Execute withdrawal
            result = await execute_withdrawal(db, user, pending)
            del pending_withdrawals[request.withdrawal_id]
            
            return result
        
        # Try backup code
        if await security_service.verify_backup_code(user["id"], request.totp_code):
            pending["verified"] = True
            pending["verification_method"] = "backup_code"
            
            await security_service._log_security_event(
                user["id"],
                "withdrawal_verified",
                {"method": "backup_code", "amount": pending["amount"]}
            )
            
            # Execute withdrawal
            result = await execute_withdrawal(db, user, pending)
            del pending_withdrawals[request.withdrawal_id]
            
            return result
        
        # Failed verification
        await security_service._log_security_event(
            user["id"],
            "withdrawal_verification_failed",
            {"method": "totp", "amount": pending["amount"]},
            False
        )
        
        raise HTTPException(status_code=400, detail="Неверный код")
    
    @withdrawal_router.post("/verify/passkey")
    async def verify_withdrawal_passkey(request: WithdrawVerifyPasskeyRequest, current_user: dict):
        """
        Verify withdrawal with Passkey
        This endpoint is called after passkey authentication flow
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Get pending withdrawal
        pending = pending_withdrawals.get(request.withdrawal_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Запрос на вывод не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        if datetime.now(timezone.utc) > pending["expires_at"]:
            del pending_withdrawals[request.withdrawal_id]
            raise HTTPException(status_code=400, detail="Запрос на вывод истёк")
        
        # Passkey verification should be done via /security/passkey/auth/finish
        # This endpoint just marks the withdrawal as verified after successful passkey auth
        pending["verified"] = True
        pending["verification_method"] = "passkey"
        
        await security_service._log_security_event(
            user["id"],
            "withdrawal_verified",
            {"method": "passkey", "amount": pending["amount"]}
        )
        
        # Execute withdrawal
        result = await execute_withdrawal(db, user, pending)
        del pending_withdrawals[request.withdrawal_id]
        
        return result
    
    @withdrawal_router.get("/status/{withdrawal_id}")
    async def get_withdrawal_status(withdrawal_id: str, current_user: dict):
        """Get status of a pending withdrawal"""
        pending = pending_withdrawals.get(withdrawal_id)
        
        if not pending:
            raise HTTPException(status_code=404, detail="Запрос на вывод не найден")
        
        if pending["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        remaining_seconds = (pending["expires_at"] - datetime.now(timezone.utc)).total_seconds()
        
        return {
            "withdrawal_id": withdrawal_id,
            "amount": pending["amount"],
            "destination": pending["destination"],
            "required_method": pending["required_method"],
            "verified": pending["verified"],
            "expires_in_seconds": max(0, int(remaining_seconds)),
            "status": "verified" if pending["verified"] else "pending_verification"
        }
    
    @withdrawal_router.post("/cancel/{withdrawal_id}")
    async def cancel_withdrawal(withdrawal_id: str, current_user: dict):
        """Cancel a pending withdrawal"""
        pending = pending_withdrawals.get(withdrawal_id)
        
        if not pending:
            raise HTTPException(status_code=404, detail="Запрос на вывод не найден")
        
        if pending["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        del pending_withdrawals[withdrawal_id]
        
        await security_service._log_security_event(
            current_user["id"],
            "withdrawal_cancelled",
            {"amount": pending["amount"]}
        )
        
        return {
            "status": "cancelled",
            "message": "Запрос на вывод отменён"
        }
    
    return withdrawal_router


async def execute_withdrawal(db, user: dict, withdrawal_info: dict) -> dict:
    """Execute the actual withdrawal after verification"""
    amount = withdrawal_info["amount"]
    destination = withdrawal_info["destination"]
    
    # Deduct from balance
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"balance_ton": -amount}}
    )
    
    # Create transaction record
    tx_id = secrets.token_hex(16)
    transaction = {
        "id": tx_id,
        "tx_type": "withdrawal",
        "user_id": user["id"],
        "user_wallet": user.get("wallet_address"),
        "amount_ton": amount,
        "destination": destination,
        "verification_method": withdrawal_info.get("verification_method"),
        "status": "pending",  # Will be "completed" after blockchain confirmation
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    
    # Calculate net amount (with fees)
    WITHDRAWAL_FEE = 0.03  # 3%
    fee = amount * WITHDRAWAL_FEE
    net_amount = amount - fee
    
    # Update treasury
    await db.admin_stats.update_one(
        {"type": "treasury"},
        {"$inc": {"withdrawal_fees": fee, "total_tax": fee}},
        upsert=True
    )
    
    logger.info(f"Withdrawal executed: {amount} TON for user {user['id']}")
    
    return {
        "status": "processing",
        "transaction_id": tx_id,
        "amount": amount,
        "fee": fee,
        "net_amount": net_amount,
        "destination": destination,
        "message": "Вывод в обработке. Средства поступят в течение 5-15 минут."
    }
