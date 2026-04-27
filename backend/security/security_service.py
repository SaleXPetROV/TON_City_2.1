"""
Security Service - Core business logic for 2FA and Passkey
Handles security checks, withdrawal validation, and security status
"""
import os
import secrets
import hashlib
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
import logging

logger = logging.getLogger(__name__)

# Security constants
WITHDRAWAL_LOCK_HOURS = 24  # Changed from 48 to 24 hours
WITHDRAWAL_LOCK_MINUTES = 3  # For testing - 3 minutes
BACKUP_CODES_COUNT = 8
PASSKEY_CHANGE_COOLDOWN_DAYS = 7


class SecurityService:
    """Service for managing user security settings"""
    
    def __init__(self, db):
        self.db = db
    
    # ==================== SECURITY STATUS ====================
    
    async def get_security_status(self, user_id: str) -> Dict[str, Any]:
        """Get complete security status for a user"""
        user = await self.db.users.find_one(
            {"$or": [{"id": user_id}, {"wallet_address": user_id}, {"email": user_id}]},
            {"_id": 0}
        )
        
        if not user:
            # Return empty/default status instead of error
            return {
                "user_id": user_id,
                "is_protected": False,
                "is_2fa_enabled": False,
                "has_passkeys": False,
                "passkeys_count": 0,
                "passkeys": [],
                "backup_codes_remaining": 0,
                "is_withdraw_locked": False,
                "withdraw_lock_remaining_hours": 0,
                "email_verified": False
            }
        
        # Get passkeys count
        passkeys = await self.db.passkeys.find(
            {"user_id": user.get("id")},
            {"_id": 0}
        ).to_list(20)
        
        is_2fa_enabled = user.get("is_2fa_enabled", False)
        has_passkeys = len(passkeys) > 0
        is_protected = is_2fa_enabled or has_passkeys
        
        # Check withdraw lock
        withdraw_lock_until = user.get("withdraw_lock_until") or user.get("withdrawal_blocked_until")
        is_withdraw_locked = False
        lock_remaining_hours = 0
        withdrawal_blocked_until_iso = None
        
        if withdraw_lock_until:
            if isinstance(withdraw_lock_until, str):
                withdraw_lock_until = datetime.fromisoformat(withdraw_lock_until.replace('Z', '+00:00'))
            if withdraw_lock_until > datetime.now(timezone.utc):
                is_withdraw_locked = True
                lock_remaining_hours = (withdraw_lock_until - datetime.now(timezone.utc)).total_seconds() / 3600
                withdrawal_blocked_until_iso = withdraw_lock_until.isoformat()
        
        return {
            "user_id": user.get("id"),
            "is_protected": is_protected,
            "is_2fa_enabled": is_2fa_enabled,
            "has_passkeys": has_passkeys,
            "passkeys_count": len(passkeys),
            "passkeys": [
                {
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "created_at": p.get("created_at"),
                    "last_used": p.get("last_used")
                }
                for p in passkeys
            ],
            "backup_codes_remaining": len(user.get("backup_codes") or []),
            "is_withdraw_locked": is_withdraw_locked,
            "withdraw_lock_remaining_hours": round(lock_remaining_hours, 1),
            "withdrawal_blocked_until": withdrawal_blocked_until_iso,
            "email_verified": bool(user.get("email"))
        }
    
    # ==================== WITHDRAWAL VALIDATION ====================
    
    async def check_withdrawal_allowed(self, user_id: str) -> Tuple[bool, str, str]:
        """
        Check if withdrawal is allowed and what verification is required
        Returns: (allowed, reason, required_method)
        required_method: "none" | "passkey" | "totp" | "blocked"
        """
        status = await self.get_security_status(user_id)
        
        if status.get("error"):
            return False, status["error"], "blocked"
        
        # Check withdraw lock
        if status["is_withdraw_locked"]:
            return False, f"Вывод заблокирован на {status['withdraw_lock_remaining_hours']:.1f} часов", "blocked"
        
        # Check if protected
        if not status["is_protected"]:
            return False, "Защитите аккаунт для вывода средств", "blocked"
        
        # Determine verification method
        if status["has_passkeys"]:
            return True, "Требуется подтверждение Passkey", "passkey"
        elif status["is_2fa_enabled"]:
            return True, "Требуется код 2FA", "totp"
        
        return False, "Неизвестная ошибка", "blocked"
    
    # ==================== WITHDRAW LOCK ====================
    
    async def set_withdraw_lock(self, user_id: str, hours: int = WITHDRAWAL_LOCK_HOURS) -> bool:
        """Set withdrawal lock for specified hours (used when disabling 2FA or changing email)"""
        lock_until = datetime.now(timezone.utc) + timedelta(hours=hours)
        
        result = await self.db.users.update_one(
            {"$or": [{"id": user_id}, {"wallet_address": user_id}, {"email": user_id}]},
            {"$set": {"withdraw_lock_until": lock_until.isoformat()}}
        )
        
        return result.modified_count > 0
    
    # ==================== BACKUP CODES ====================
    
    @staticmethod
    def generate_backup_codes(count: int = BACKUP_CODES_COUNT) -> Tuple[List[str], List[str]]:
        """
        Generate backup codes
        Returns: (plain_codes, hashed_codes)
        """
        plain_codes = []
        hashed_codes = []
        
        for _ in range(count):
            # Generate 8-character alphanumeric code
            code = secrets.token_hex(4).upper()
            plain_codes.append(code)
            hashed_codes.append(hashlib.sha256(code.encode()).hexdigest())
        
        return plain_codes, hashed_codes
    
    async def verify_backup_code(self, user_id: str, code: str) -> bool:
        """Verify and consume a backup code"""
        user = await self.db.users.find_one(
            {"$or": [{"id": user_id}, {"wallet_address": user_id}, {"email": user_id}]},
            {"_id": 0}
        )
        
        if not user:
            return False
        
        backup_codes = user.get("backup_codes", [])
        code_hash = hashlib.sha256(code.upper().encode()).hexdigest()
        
        if code_hash in backup_codes:
            # Remove used code
            backup_codes.remove(code_hash)
            await self.db.users.update_one(
                {"id": user.get("id")},
                {"$set": {"backup_codes": backup_codes}}
            )
            
            # Log usage
            await self._log_security_event(
                user.get("id"),
                "backup_code_used",
                {"codes_remaining": len(backup_codes)}
            )
            
            return True
        
        return False
    
    # ==================== SECURITY LOGGING ====================
    
    async def _log_security_event(
        self,
        user_id: str,
        event_type: str,
        details: Dict[str, Any] = None,
        success: bool = True
    ):
        """Log security events for audit trail"""
        log_entry = {
            "id": secrets.token_hex(16),
            "user_id": user_id,
            "event_type": event_type,
            "success": success,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip_address": None  # Can be added from request context
        }
        
        await self.db.security_logs.insert_one(log_entry)
        
        level = logging.INFO if success else logging.WARNING
        logger.log(level, f"Security event: {event_type} for user {user_id}, success={success}")
    
    async def get_security_logs(
        self,
        user_id: str,
        event_types: List[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get security logs for a user"""
        query = {"user_id": user_id}
        if event_types:
            query["event_type"] = {"$in": event_types}
        
        logs = await self.db.security_logs.find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        return logs
