"""
TOTP (Time-based One-Time Password) Handler
Implements RFC 6238 TOTP for Google Authenticator / Authy compatibility
"""
import os
import pyotp
import qrcode
import io
import base64
import secrets
import hashlib
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import logging
import resend

from .security_service import SecurityService

logger = logging.getLogger(__name__)

# Initialize resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

totp_router = APIRouter(prefix="/security/totp", tags=["security", "2fa"])

# Store pending disable requests (in production use Redis)
pending_disable_requests: Dict[str, Dict[str, Any]] = {}

# ==================== REQUEST MODELS ====================

class TOTPSetupRequest(BaseModel):
    """Request to start TOTP setup"""
    pass

class TOTPVerifyRequest(BaseModel):
    """Verify TOTP code"""
    code: str

class TOTPDisableStartRequest(BaseModel):
    """Start 2FA disable process"""
    pass

class TOTPDisableConfirmRequest(BaseModel):
    """Confirm 2FA disable with both codes"""
    email_code: str
    totp_code: str


# ==================== HELPER FUNCTIONS ====================

def generate_totp_secret() -> str:
    """Generate a new TOTP secret (32 chars, base32)"""
    return pyotp.random_base32(length=32)


def get_totp_uri(secret: str, email: str, issuer: str = "TON-City") -> str:
    """Generate TOTP provisioning URI for authenticator apps"""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def generate_qr_code_base64(uri: str) -> str:
    """Generate QR code as base64 data URL"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_base64}"


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify TOTP code with time drift tolerance"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)


async def send_disable_2fa_email(email: str, code: str):
    """Send email with verification code for 2FA disable"""
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0c; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #00F0FF; margin: 0;">TON-City</h1>
            <p style="color: #888; margin-top: 8px;">Запрос на отключение 2FA</p>
        </div>
        
        <div style="background: rgba(255, 0, 85, 0.1); border: 1px solid rgba(255, 0, 85, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="color: #FF0055; margin: 0; font-weight: bold;">Внимание!</p>
            <p style="color: #ccc; margin: 8px 0 0 0; font-size: 14px;">
                Кто-то запросил отключение двухфакторной аутентификации для вашего аккаунта.
                Если это были не вы, проигнорируйте это письмо.
            </p>
        </div>
        
        <div style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 24px;">
            <p style="color: #888; margin: 0 0 12px 0; font-size: 14px;">Ваш код подтверждения:</p>
            <div style="font-size: 36px; font-weight: bold; color: #00F0FF; letter-spacing: 8px; font-family: monospace;">
                {code}
            </div>
            <p style="color: #666; margin: 12px 0 0 0; font-size: 12px;">Код действителен 15 минут</p>
        </div>
        
        <p style="color: #666; font-size: 12px; text-align: center;">
            После отключения 2FA вывод средств будет заблокирован на 48 часов.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "TON-City: Код для отключения 2FA",
        "html": html_content
    }
    
    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"2FA disable email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send 2FA disable email: {e}")
        return False


# ==================== ROUTES ====================

def create_totp_routes(db):
    """Factory function to create routes with database access"""
    
    security_service = SecurityService(db)
    
    @totp_router.post("/setup/start")
    async def start_totp_setup(current_user: dict):
        """
        Step 1: Generate TOTP secret and QR code
        Returns secret and QR code for authenticator app
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        if user.get("is_2fa_enabled"):
            raise HTTPException(status_code=400, detail="2FA уже включена")
        
        if not user.get("email"):
            raise HTTPException(status_code=400, detail="Для 2FA требуется привязать email")
        
        # Generate new secret
        secret = generate_totp_secret()
        uri = get_totp_uri(secret, user["email"])
        qr_code = generate_qr_code_base64(uri)
        
        # Store pending setup (temporary, not activated yet)
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"pending_2fa_secret": secret}}
        )
        
        return {
            "status": "pending",
            "secret": secret,  # For manual entry
            "qr_code": qr_code,
            "uri": uri,
            "message": "Отсканируйте QR-код в приложении аутентификации и введите код для подтверждения"
        }
    
    @totp_router.post("/setup/confirm")
    async def confirm_totp_setup(request: TOTPVerifyRequest, current_user: dict):
        """
        Step 2: Verify code and activate 2FA
        Also generates backup codes
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        pending_secret = user.get("pending_2fa_secret")
        if not pending_secret:
            raise HTTPException(status_code=400, detail="Сначала начните настройку 2FA")
        
        # Verify code
        if not verify_totp_code(pending_secret, request.code):
            await security_service._log_security_event(
                user["id"], "2fa_setup_failed", {"reason": "invalid_code"}, False
            )
            raise HTTPException(status_code=400, detail="Неверный код")
        
        # Generate backup codes
        plain_codes, hashed_codes = SecurityService.generate_backup_codes()
        
        # Activate 2FA
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "two_factor_secret": pending_secret,
                    "is_2fa_enabled": True,
                    "backup_codes": hashed_codes,
                    "2fa_enabled_at": datetime.now(timezone.utc).isoformat(),
                    "withdrawal_blocked_until": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()  # 24 hours lock
                },
                "$unset": {"pending_2fa_secret": ""}
            }
        )
        
        await security_service._log_security_event(
            user["id"], "2fa_enabled", {"backup_codes_count": len(plain_codes), "withdraw_locked_hours": 24}
        )
        
        # Schedule telegram notification for when withdrawal unlocks
        unlock_time = datetime.now(timezone.utc) + timedelta(hours=24)
        await db.scheduled_notifications.insert_one({
            "user_id": user["id"],
            "type": "withdrawal_unlocked",
            "scheduled_at": unlock_time.isoformat(),
            "sent": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "status": "enabled",
            "message": "2FA успешно активирована! Вывод средств заблокирован на 3 минуты.",
            "backup_codes": plain_codes,
            "warning": "Сохраните резервные коды в безопасном месте. Они не будут показаны снова!",
            "withdrawal_blocked_until": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        }
    
    @totp_router.post("/verify")
    async def verify_totp(request: TOTPVerifyRequest, current_user: dict):
        """Verify TOTP code for withdrawal or other sensitive operations"""
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        if not user.get("is_2fa_enabled"):
            raise HTTPException(status_code=400, detail="2FA не активирована")
        
        secret = user.get("two_factor_secret")
        if not secret:
            raise HTTPException(status_code=500, detail="Ошибка конфигурации 2FA")
        
        # Try TOTP code first
        if verify_totp_code(secret, request.code):
            await security_service._log_security_event(
                user["id"], "2fa_verification", {"method": "totp"}, True
            )
            return {"verified": True, "method": "totp"}
        
        # Try backup code
        if await security_service.verify_backup_code(user["id"], request.code):
            return {"verified": True, "method": "backup_code"}
        
        # Failed
        await security_service._log_security_event(
            user["id"], "2fa_verification", {"method": "totp"}, False
        )
        raise HTTPException(status_code=400, detail="Неверный код")
    
    @totp_router.post("/disable/start")
    async def start_disable_2fa(current_user: dict):
        """
        Step 1 of 2FA disable: Send verification code to email
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        if not user.get("is_2fa_enabled"):
            raise HTTPException(status_code=400, detail="2FA не активирована")
        
        if not user.get("email"):
            raise HTTPException(status_code=400, detail="Email не привязан")
        
        # Generate email verification code
        email_code = secrets.token_hex(3).upper()  # 6 chars
        
        # Store pending disable request
        request_id = secrets.token_hex(16)
        pending_disable_requests[request_id] = {
            "user_id": user["id"],
            "email_code_hash": hashlib.sha256(email_code.encode()).hexdigest(),
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15)
        }
        
        # Send email
        email_sent = await send_disable_2fa_email(user["email"], email_code)
        if not email_sent:
            # Log the code for development/testing (won't send in restricted Resend mode)
            logger.warning(f"2FA disable code for {user['email']}: {email_code} (email delivery failed)")
        
        await security_service._log_security_event(
            user["id"], "2fa_disable_requested", {"email": user["email"]}
        )
        
        return {
            "status": "pending",
            "request_id": request_id,
            "message": "Код отправлен на email. Введите код из email и код из приложения 2FA."
        }
    
    @totp_router.post("/disable/confirm")
    async def confirm_disable_2fa(request: TOTPDisableConfirmRequest, request_id: str, current_user: dict):
        """
        Step 2 of 2FA disable: Verify both email code AND TOTP code
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Get pending request
        pending = pending_disable_requests.get(request_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Запрос не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        if datetime.now(timezone.utc) > pending["expires_at"]:
            del pending_disable_requests[request_id]
            raise HTTPException(status_code=400, detail="Запрос истёк")
        
        # Verify email code
        email_code_hash = hashlib.sha256(request.email_code.upper().encode()).hexdigest()
        if email_code_hash != pending["email_code_hash"]:
            await security_service._log_security_event(
                user["id"], "2fa_disable_failed", {"reason": "invalid_email_code"}, False
            )
            raise HTTPException(status_code=400, detail="Неверный код из email")
        
        # Verify TOTP code
        secret = user.get("two_factor_secret")
        if not verify_totp_code(secret, request.totp_code):
            await security_service._log_security_event(
                user["id"], "2fa_disable_failed", {"reason": "invalid_totp"}, False
            )
            raise HTTPException(status_code=400, detail="Неверный код 2FA")
        
        # Both codes verified - disable 2FA
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "is_2fa_enabled": False,
                    "withdrawal_blocked_until": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()  # 24 hours lock
                },
                "$unset": {
                    "two_factor_secret": "",
                    "backup_codes": "",
                    "pending_2fa_secret": ""
                }
            }
        )
        
        # Clean up pending request
        del pending_disable_requests[request_id]
        
        await security_service._log_security_event(
            user["id"], "2fa_disabled", {"withdraw_locked_hours": 24}
        )
        
        # Schedule telegram notification for when withdrawal unlocks
        unlock_time = datetime.now(timezone.utc) + timedelta(hours=24)
        await db.scheduled_notifications.insert_one({
            "user_id": user["id"],
            "type": "withdrawal_unlocked",
            "scheduled_at": unlock_time.isoformat(),
            "sent": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "status": "disabled",
            "message": "2FA отключена. Вывод средств заблокирован на 3 минуты.",
            "withdrawal_blocked_until": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        }
    
    return totp_router
