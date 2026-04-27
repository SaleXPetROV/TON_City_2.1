"""
Security Router Integration
Combines all security routes and integrates with main server
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import os
import logging

from .totp_handler import create_totp_routes
from .passkey_handler import create_passkey_routes
from .withdrawal_handler import create_withdrawal_routes
from .security_service import SecurityService

logger = logging.getLogger(__name__)

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'ton-city-builder-secret-key-2025')
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


def create_security_router(db):
    """Create main security router with all sub-routes"""
    
    security_router = APIRouter(prefix="/api/security", tags=["security"])
    security_service = SecurityService(db)
    
    # Auth dependency for security routes
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
    
    # ==================== MAIN SECURITY STATUS ====================
    
    @security_router.get("/status")
    async def get_security_status(current_user: dict = Depends(get_current_user)):
        """Get complete security status for current user"""
        status = await security_service.get_security_status(current_user["id"])
        return status
    
    @security_router.get("/logs")
    async def get_security_logs(
        limit: int = 50,
        current_user: dict = Depends(get_current_user)
    ):
        """Get security audit logs for current user"""
        logs = await security_service.get_security_logs(current_user["id"], limit=limit)
        return {"logs": logs, "count": len(logs)}
    
    # ==================== TOTP ROUTES ====================
    
    # Helper function to build safe user query
    def build_user_query(current_user: dict) -> dict:
        """Build MongoDB query avoiding None values that match all null fields"""
        conditions = []
        if current_user.get("id"):
            conditions.append({"id": current_user["id"]})
        if current_user.get("wallet_address"):
            conditions.append({"wallet_address": current_user["wallet_address"]})
        if current_user.get("email"):
            conditions.append({"email": current_user["email"]})
        return {"$or": conditions} if conditions else {"id": "NOMATCH"}
    
    @security_router.post("/totp/setup/start")
    async def start_totp_setup(current_user: dict = Depends(get_current_user)):
        """Start TOTP (2FA) setup - generates QR code"""
        from .totp_handler import generate_totp_secret, get_totp_uri, generate_qr_code_base64
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        if user.get("is_2fa_enabled"):
            raise HTTPException(status_code=400, detail="2FA уже включена")
        
        if not user.get("email"):
            raise HTTPException(status_code=400, detail="Для 2FA требуется привязать email")
        
        secret = generate_totp_secret()
        uri = get_totp_uri(secret, user["email"])
        qr_code = generate_qr_code_base64(uri)
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"pending_2fa_secret": secret}}
        )
        
        return {
            "status": "pending",
            "secret": secret,
            "qr_code": qr_code,
            "uri": uri,
            "message": "Отсканируйте QR-код в приложении аутентификации"
        }
    
    @security_router.post("/totp/setup/confirm")
    async def confirm_totp_setup(code: str, current_user: dict = Depends(get_current_user)):
        """Confirm TOTP setup with code from authenticator"""
        from .totp_handler import verify_totp_code
        from datetime import datetime, timezone
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        pending_secret = user.get("pending_2fa_secret")
        if not pending_secret:
            raise HTTPException(status_code=400, detail="Сначала начните настройку 2FA")
        
        if not verify_totp_code(pending_secret, code):
            await security_service._log_security_event(
                user["id"], "2fa_setup_failed", {"reason": "invalid_code"}, False
            )
            raise HTTPException(status_code=400, detail="Неверный код")
        
        plain_codes, hashed_codes = SecurityService.generate_backup_codes()
        
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "two_factor_secret": pending_secret,
                    "is_2fa_enabled": True,
                    "backup_codes": hashed_codes,
                    "2fa_enabled_at": datetime.now(timezone.utc).isoformat()
                },
                "$unset": {"pending_2fa_secret": ""}
            }
        )
        
        await security_service._log_security_event(
            user["id"], "2fa_enabled", {"backup_codes_count": len(plain_codes)}
        )
        
        return {
            "status": "enabled",
            "message": "2FA успешно активирована!",
            "backup_codes": plain_codes,
            "warning": "Сохраните резервные коды в безопасном месте!"
        }
    
    @security_router.post("/totp/verify")
    async def verify_totp(code: str, current_user: dict = Depends(get_current_user)):
        """Verify TOTP code"""
        from .totp_handler import verify_totp_code
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        if not user.get("is_2fa_enabled"):
            raise HTTPException(status_code=400, detail="2FA не активирована")
        
        secret = user.get("two_factor_secret")
        if not secret:
            raise HTTPException(status_code=500, detail="Ошибка конфигурации 2FA")
        
        if verify_totp_code(secret, code):
            await security_service._log_security_event(
                user["id"], "2fa_verification", {"method": "totp"}, True
            )
            return {"verified": True, "method": "totp"}
        
        if await security_service.verify_backup_code(user["id"], code):
            return {"verified": True, "method": "backup_code"}
        
        await security_service._log_security_event(
            user["id"], "2fa_verification", {"method": "totp"}, False
        )
        raise HTTPException(status_code=400, detail="Неверный код")
    
    @security_router.post("/totp/disable/start")
    async def start_disable_totp(current_user: dict = Depends(get_current_user)):
        """Start 2FA disable process - sends email code"""
        from .totp_handler import send_disable_2fa_email, pending_disable_requests
        import secrets
        import hashlib
        from datetime import datetime, timezone, timedelta
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        if not user.get("is_2fa_enabled"):
            raise HTTPException(status_code=400, detail="2FA не активирована")
        
        if not user.get("email"):
            raise HTTPException(status_code=400, detail="Email не привязан")
        
        email_code = secrets.token_hex(3).upper()
        request_id = secrets.token_hex(16)
        
        pending_disable_requests[request_id] = {
            "user_id": user["id"],
            "email_code_hash": hashlib.sha256(email_code.encode()).hexdigest(),
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15)
        }
        
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
            "message": "Код отправлен на email"
        }
    
    @security_router.post("/totp/disable/confirm")
    async def confirm_disable_totp(
        request_id: str,
        email_code: str,
        totp_code: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Confirm 2FA disable with both codes"""
        from .totp_handler import verify_totp_code, pending_disable_requests
        import hashlib
        from datetime import datetime, timezone, timedelta
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        pending = pending_disable_requests.get(request_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Запрос не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        if datetime.now(timezone.utc) > pending["expires_at"]:
            del pending_disable_requests[request_id]
            raise HTTPException(status_code=400, detail="Запрос истёк")
        
        email_code_hash = hashlib.sha256(email_code.upper().encode()).hexdigest()
        if email_code_hash != pending["email_code_hash"]:
            await security_service._log_security_event(
                user["id"], "2fa_disable_failed", {"reason": "invalid_email_code"}, False
            )
            raise HTTPException(status_code=400, detail="Неверный код из email")
        
        secret = user.get("two_factor_secret")
        if not verify_totp_code(secret, totp_code):
            await security_service._log_security_event(
                user["id"], "2fa_disable_failed", {"reason": "invalid_totp"}, False
            )
            raise HTTPException(status_code=400, detail="Неверный код 2FA")
        
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "is_2fa_enabled": False,
                    "withdrawal_blocked_until": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()  # 24 hours lock after 2FA disable
                },
                "$unset": {
                    "two_factor_secret": "",
                    "backup_codes": "",
                    "pending_2fa_secret": ""
                }
            }
        )
        
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
            "message": "2FA отключена. Вывод заблокирован на 24 часа.",
            "withdraw_lock_hours": 24
        }
    
    # ==================== PASSKEY ROUTES ====================
    
    @security_router.post("/passkey/register/start")
    async def start_passkey_register(
        device_name: str = "My Device",
        current_user: dict = Depends(get_current_user)
    ):
        """Start passkey registration"""
        from .passkey_handler import (
            pending_challenges, RP_ID, RP_NAME, ORIGIN,
            generate_registration_options, options_to_json, bytes_to_base64url,
            base64url_to_bytes, AuthenticatorSelectionCriteria,
            AuthenticatorAttachment, ResidentKeyRequirement,
            UserVerificationRequirement, PublicKeyCredentialDescriptor,
            AuthenticatorTransport
        )
        import secrets
        import json
        from datetime import datetime, timezone
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        user_id = user.get("id")
        username = user.get("username") or user.get("email") or user_id[:8]
        
        existing_passkeys = await db.passkeys.find(
            {"user_id": user_id},
            {"_id": 0, "credential_id": 1}
        ).to_list(20)
        
        exclude_credentials = [
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(p["credential_id"]),
                transports=[AuthenticatorTransport.INTERNAL, AuthenticatorTransport.HYBRID]
            )
            for p in existing_passkeys
        ]
        
        options = generate_registration_options(
            rp_id=RP_ID,
            rp_name=RP_NAME,
            user_id=user_id.encode(),
            user_name=username,
            user_display_name=user.get("display_name") or username,
            exclude_credentials=exclude_credentials,
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.REQUIRED
            ),
            timeout=60000
        )
        
        challenge_id = secrets.token_hex(16)
        pending_challenges[challenge_id] = {
            "user_id": user_id,
            "challenge": bytes_to_base64url(options.challenge),
            "device_name": device_name,
            "created_at": datetime.now(timezone.utc)
        }
        
        options_json = json.loads(options_to_json(options))
        
        return {
            "challenge_id": challenge_id,
            "options": options_json
        }
    
    @security_router.post("/passkey/register/finish")
    async def finish_passkey_register(
        challenge_id: str,
        credential: dict,
        device_name: str = "My Device",
        current_user: dict = Depends(get_current_user)
    ):
        """Finish passkey registration"""
        from .passkey_handler import (
            pending_challenges, RP_ID, ORIGIN,
            verify_registration_response, bytes_to_base64url, base64url_to_bytes
        )
        import secrets
        from datetime import datetime, timezone
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        pending = pending_challenges.get(challenge_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Challenge не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        try:
            verification = verify_registration_response(
                credential=credential,
                expected_challenge=base64url_to_bytes(pending["challenge"]),
                expected_rp_id=RP_ID,
                expected_origin=ORIGIN,
                require_user_verification=True
            )
            
            passkey_id = secrets.token_hex(16)
            passkey_doc = {
                "id": passkey_id,
                "user_id": user["id"],
                "credential_id": bytes_to_base64url(verification.credential_id),
                "public_key": bytes_to_base64url(verification.credential_public_key),
                "sign_count": verification.sign_count,
                "name": device_name or pending.get("device_name", "My Device"),
                "aaguid": bytes_to_base64url(verification.aaguid) if verification.aaguid else None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_used": None
            }
            
            await db.passkeys.insert_one(passkey_doc)
            del pending_challenges[challenge_id]
            
            await security_service._log_security_event(
                user["id"],
                "passkey_registered",
                {"passkey_id": passkey_id, "device_name": passkey_doc["name"]}
            )
            
            return {
                "status": "registered",
                "passkey_id": passkey_id,
                "device_name": passkey_doc["name"],
                "message": "Passkey успешно зарегистрирован!"
            }
            
        except Exception as e:
            await security_service._log_security_event(
                user["id"],
                "passkey_registration_failed",
                {"error": str(e)},
                False
            )
            raise HTTPException(status_code=400, detail=f"Ошибка регистрации: {str(e)}")
    
    @security_router.post("/passkey/auth/start")
    async def start_passkey_auth(current_user: dict = Depends(get_current_user)):
        """Start passkey authentication for withdrawal"""
        from .passkey_handler import (
            pending_challenges, RP_ID,
            generate_authentication_options, options_to_json,
            bytes_to_base64url, base64url_to_bytes,
            PublicKeyCredentialDescriptor, AuthenticatorTransport,
            UserVerificationRequirement
        )
        import secrets
        import json
        from datetime import datetime, timezone
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        passkeys = await db.passkeys.find(
            {"user_id": user["id"]},
            {"_id": 0}
        ).to_list(20)
        
        if not passkeys:
            raise HTTPException(status_code=400, detail="Passkey не найден. Сначала зарегистрируйте устройство.")
        
        allow_credentials = [
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(p["credential_id"]),
                transports=[AuthenticatorTransport.INTERNAL, AuthenticatorTransport.HYBRID]
            )
            for p in passkeys
        ]
        
        options = generate_authentication_options(
            rp_id=RP_ID,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED,
            timeout=60000
        )
        
        challenge_id = secrets.token_hex(16)
        pending_challenges[challenge_id] = {
            "user_id": user["id"],
            "challenge": bytes_to_base64url(options.challenge),
            "type": "authentication",
            "created_at": datetime.now(timezone.utc)
        }
        
        options_json = json.loads(options_to_json(options))
        
        return {
            "challenge_id": challenge_id,
            "options": options_json
        }
    
    @security_router.post("/passkey/auth/finish")
    async def finish_passkey_auth(
        challenge_id: str,
        credential: dict,
        current_user: dict = Depends(get_current_user)
    ):
        """Finish passkey authentication"""
        from .passkey_handler import (
            pending_challenges, RP_ID, ORIGIN,
            verify_authentication_response, base64url_to_bytes
        )
        from datetime import datetime, timezone
        
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        pending = pending_challenges.get(challenge_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Challenge не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        credential_id = credential.get("id")
        if not credential_id:
            raise HTTPException(status_code=400, detail="Credential ID не найден")
        
        passkey = await db.passkeys.find_one(
            {"user_id": user["id"], "credential_id": credential_id},
            {"_id": 0}
        )
        
        if not passkey:
            raise HTTPException(status_code=400, detail="Passkey не найден")
        
        try:
            verification = verify_authentication_response(
                credential=credential,
                expected_challenge=base64url_to_bytes(pending["challenge"]),
                expected_rp_id=RP_ID,
                expected_origin=ORIGIN,
                credential_public_key=base64url_to_bytes(passkey["public_key"]),
                credential_current_sign_count=passkey.get("sign_count", 0),
                require_user_verification=True
            )
            
            await db.passkeys.update_one(
                {"id": passkey["id"]},
                {"$set": {
                    "sign_count": verification.new_sign_count,
                    "last_used": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            del pending_challenges[challenge_id]
            
            await security_service._log_security_event(
                user["id"],
                "passkey_authentication",
                {"passkey_id": passkey["id"], "device_name": passkey.get("name")}
            )
            
            return {
                "verified": True,
                "passkey_id": passkey["id"],
                "device_name": passkey.get("name"),
                "message": "Passkey успешно верифицирован!"
            }
            
        except Exception as e:
            await security_service._log_security_event(
                user["id"],
                "passkey_authentication_failed",
                {"error": str(e)},
                False
            )
            raise HTTPException(status_code=400, detail=f"Ошибка аутентификации: {str(e)}")
    
    @security_router.get("/passkey/list")
    async def list_passkeys(current_user: dict = Depends(get_current_user)):
        """List all user's passkeys"""
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        passkeys = await db.passkeys.find(
            {"user_id": user["id"]},
            {"_id": 0, "public_key": 0}
        ).to_list(20)
        
        return {
            "passkeys": passkeys,
            "count": len(passkeys)
        }
    
    @security_router.delete("/passkey/{passkey_id}")
    async def delete_passkey(passkey_id: str, current_user: dict = Depends(get_current_user)):
        """Delete a passkey"""
        user = await db.users.find_one(
            build_user_query(current_user),
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        passkey = await db.passkeys.find_one(
            {"id": passkey_id, "user_id": user["id"]},
            {"_id": 0}
        )
        
        if not passkey:
            raise HTTPException(status_code=404, detail="Passkey не найден")
        
        status = await security_service.get_security_status(user["id"])
        if status["passkeys_count"] == 1 and not status["is_2fa_enabled"]:
            raise HTTPException(
                status_code=400,
                detail="Нельзя удалить последний Passkey без включенной 2FA"
            )
        
        await db.passkeys.delete_one({"id": passkey_id})
        
        await security_service._log_security_event(
            user["id"],
            "passkey_deleted",
            {"passkey_id": passkey_id, "device_name": passkey.get("name")}
        )
        
        return {
            "status": "deleted",
            "passkey_id": passkey_id,
            "message": "Passkey удалён"
        }
    
    return security_router
