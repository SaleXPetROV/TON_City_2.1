"""
Passkey (WebAuthn) Handler
Implements FIDO2/WebAuthn for passwordless authentication and transaction verification
"""
import os
import secrets
import base64
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import logging

# WebAuthn library
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json
)
from webauthn.helpers import (
    bytes_to_base64url,
    base64url_to_bytes
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    AuthenticatorAttachment,
    PublicKeyCredentialDescriptor,
    AuthenticatorTransport
)

from .security_service import SecurityService

logger = logging.getLogger(__name__)

passkey_router = APIRouter(prefix="/security/passkey", tags=["security", "passkey"])

# WebAuthn Configuration
RP_ID = os.environ.get("WEBAUTHN_RP_ID", "localhost")
RP_NAME = "TON-City"
ORIGIN = os.environ.get("WEBAUTHN_ORIGIN", "http://localhost:3000")

# Store challenges temporarily (in production use Redis with TTL)
pending_challenges: Dict[str, Dict[str, Any]] = {}


# ==================== REQUEST MODELS ====================

class PasskeyRegisterStartRequest(BaseModel):
    """Request to start passkey registration"""
    device_name: Optional[str] = "My Device"

class PasskeyRegisterFinishRequest(BaseModel):
    """Finish passkey registration with authenticator response"""
    credential: Dict[str, Any]
    device_name: Optional[str] = "My Device"

class PasskeyAuthStartRequest(BaseModel):
    """Start passkey authentication"""
    pass

class PasskeyAuthFinishRequest(BaseModel):
    """Finish passkey authentication"""
    credential: Dict[str, Any]

class PasskeyDeleteRequest(BaseModel):
    """Delete a passkey"""
    passkey_id: str


# ==================== HELPER FUNCTIONS ====================

def create_challenge() -> str:
    """Generate a random challenge"""
    return secrets.token_hex(32)


# ==================== ROUTES ====================

def create_passkey_routes(db):
    """Factory function to create routes with database access"""
    
    security_service = SecurityService(db)
    
    @passkey_router.post("/register/start")
    async def start_passkey_registration(request: PasskeyRegisterStartRequest, current_user: dict):
        """
        Step 1: Generate registration options for authenticator
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        user_id = user.get("id")
        username = user.get("username") or user.get("email") or user_id[:8]
        
        # Get existing passkeys to exclude
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
        
        # Generate registration options
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
            timeout=60000  # 60 seconds
        )
        
        # Store challenge
        challenge_id = secrets.token_hex(16)
        pending_challenges[challenge_id] = {
            "user_id": user_id,
            "challenge": bytes_to_base64url(options.challenge),
            "device_name": request.device_name,
            "created_at": datetime.now(timezone.utc)
        }
        
        # Convert options to JSON-serializable format
        options_json = json.loads(options_to_json(options))
        
        return {
            "challenge_id": challenge_id,
            "options": options_json
        }
    
    @passkey_router.post("/register/finish")
    async def finish_passkey_registration(
        request: PasskeyRegisterFinishRequest,
        challenge_id: str,
        current_user: dict
    ):
        """
        Step 2: Verify registration response and store credential
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Get pending challenge
        pending = pending_challenges.get(challenge_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Challenge не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        try:
            # Verify registration response
            verification = verify_registration_response(
                credential=request.credential,
                expected_challenge=base64url_to_bytes(pending["challenge"]),
                expected_rp_id=RP_ID,
                expected_origin=ORIGIN,
                require_user_verification=True
            )
            
            # Store passkey
            passkey_id = secrets.token_hex(16)
            passkey_doc = {
                "id": passkey_id,
                "user_id": user["id"],
                "credential_id": bytes_to_base64url(verification.credential_id),
                "public_key": bytes_to_base64url(verification.credential_public_key),
                "sign_count": verification.sign_count,
                "name": request.device_name or pending.get("device_name", "My Device"),
                "aaguid": bytes_to_base64url(verification.aaguid) if verification.aaguid else None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_used": None
            }
            
            await db.passkeys.insert_one(passkey_doc)
            
            # Clean up challenge
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
            logger.error(f"Passkey registration failed: {e}")
            await security_service._log_security_event(
                user["id"],
                "passkey_registration_failed",
                {"error": str(e)},
                False
            )
            raise HTTPException(status_code=400, detail=f"Ошибка регистрации: {str(e)}")
    
    @passkey_router.post("/auth/start")
    async def start_passkey_authentication(current_user: dict):
        """
        Start passkey authentication (for withdrawal verification)
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Get user's passkeys
        passkeys = await db.passkeys.find(
            {"user_id": user["id"]},
            {"_id": 0}
        ).to_list(20)
        
        if not passkeys:
            raise HTTPException(status_code=400, detail="Passkey не найден. Сначала зарегистрируйте устройство.")
        
        # Create allowed credentials list
        allow_credentials = [
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(p["credential_id"]),
                transports=[AuthenticatorTransport.INTERNAL, AuthenticatorTransport.HYBRID]
            )
            for p in passkeys
        ]
        
        # Generate authentication options
        options = generate_authentication_options(
            rp_id=RP_ID,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED,
            timeout=60000
        )
        
        # Store challenge
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
    
    @passkey_router.post("/auth/finish")
    async def finish_passkey_authentication(
        request: PasskeyAuthFinishRequest,
        challenge_id: str,
        current_user: dict
    ):
        """
        Verify passkey authentication response
        """
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Get pending challenge
        pending = pending_challenges.get(challenge_id)
        if not pending:
            raise HTTPException(status_code=400, detail="Challenge не найден или истёк")
        
        if pending["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Get credential ID from response
        credential_id = request.credential.get("id")
        if not credential_id:
            raise HTTPException(status_code=400, detail="Credential ID не найден")
        
        # Find matching passkey
        passkey = await db.passkeys.find_one(
            {"user_id": user["id"], "credential_id": credential_id},
            {"_id": 0}
        )
        
        if not passkey:
            raise HTTPException(status_code=400, detail="Passkey не найден")
        
        try:
            # Verify authentication response
            verification = verify_authentication_response(
                credential=request.credential,
                expected_challenge=base64url_to_bytes(pending["challenge"]),
                expected_rp_id=RP_ID,
                expected_origin=ORIGIN,
                credential_public_key=base64url_to_bytes(passkey["public_key"]),
                credential_current_sign_count=passkey.get("sign_count", 0),
                require_user_verification=True
            )
            
            # Update sign count and last used
            await db.passkeys.update_one(
                {"id": passkey["id"]},
                {"$set": {
                    "sign_count": verification.new_sign_count,
                    "last_used": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Clean up challenge
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
            logger.error(f"Passkey authentication failed: {e}")
            await security_service._log_security_event(
                user["id"],
                "passkey_authentication_failed",
                {"error": str(e)},
                False
            )
            raise HTTPException(status_code=400, detail=f"Ошибка аутентификации: {str(e)}")
    
    @passkey_router.get("/list")
    async def list_passkeys(current_user: dict):
        """List all user's passkeys"""
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        passkeys = await db.passkeys.find(
            {"user_id": user["id"]},
            {"_id": 0, "public_key": 0}  # Exclude sensitive data
        ).to_list(20)
        
        return {
            "passkeys": passkeys,
            "count": len(passkeys)
        }
    
    @passkey_router.delete("/delete/{passkey_id}")
    async def delete_passkey(passkey_id: str, current_user: dict):
        """Delete a passkey"""
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
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
        
        # Check if this is the last passkey and 2FA is disabled
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
    
    @passkey_router.put("/rename/{passkey_id}")
    async def rename_passkey(passkey_id: str, new_name: str, current_user: dict):
        """Rename a passkey"""
        user = await db.users.find_one(
            {"$or": [{"id": current_user["id"]}, {"wallet_address": current_user.get("wallet_address")}]},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        result = await db.passkeys.update_one(
            {"id": passkey_id, "user_id": user["id"]},
            {"$set": {"name": new_name}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Passkey не найден")
        
        return {
            "status": "renamed",
            "passkey_id": passkey_id,
            "new_name": new_name
        }
    
    return passkey_router
