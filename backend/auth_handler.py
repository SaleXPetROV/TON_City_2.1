import os
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from typing import Optional
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# --- КОНФИГУРАЦИЯ ---
# S1: pull secret from security_middleware (already sanitized + randomized if missing)
from security_middleware import (
    limiter, validate_password_strength,
    check_login_lockout_async, record_login_failure_async, record_login_success_async,
)
SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or ""  # set by server.py before import-time usage
if not SECRET_KEY:
    # Fallback: generate own if server.py hasn't initialized yet
    from security_middleware import get_or_generate_jwt_secret
    SECRET_KEY = get_or_generate_jwt_secret()
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")  # Add to .env
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")  # Add to .env

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
auth_router = APIRouter(prefix="/auth", tags=["Auth"])

# --- МОДЕЛИ ДАННЫХ ---
class EmailRegister(BaseModel):
    email: EmailStr
    password: str
    username: str

class EmailRegisterInitiate(BaseModel):
    email: EmailStr
    password: str
    username: str

class EmailVerifyCode(BaseModel):
    email: EmailStr
    code: str

class EmailLogin(BaseModel):
    email: str  # Changed from EmailStr to str to allow username
    password: str

class GoogleAuth(BaseModel):
    credential: str  # Google ID token

class WalletAuth(BaseModel):
    address: str

class UsernameUpdate(BaseModel):
    username: str


# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
def generate_avatar_from_initials(name: str) -> str:
    """Генерирует SVG аватар из первых букв имени"""
    if not name:
        name = "U"
    
    # Берем первую букву (или две, если есть пробел)
    parts = name.strip().split()
    if len(parts) >= 2:
        initials = (parts[0][0] + parts[1][0]).upper()
    else:
        initials = name[0].upper()
    
    # Генерируем цвет на основе имени
    hash_val = sum(ord(c) for c in name)
    colors = [
        "#00F0FF",  # cyber-cyan
        "#B026FF",  # neon-purple  
        "#FF6B9D",  # pink
        "#FFB800",  # amber
        "#00FF88",  # green
    ]
    color = colors[hash_val % len(colors)]
    
    # SVG аватар
    svg = f'''<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="{color}"/>
        <text x="50" y="50" font-family="Arial" font-size="40" font-weight="bold" 
              fill="#000" text-anchor="middle" dominant-baseline="central">{initials}</text>
    </svg>'''
    
    return f"data:image/svg+xml;base64,{__import__('base64').b64encode(svg.encode()).decode()}"

def create_token(data: dict):
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Зависимость для получения текущего пользователя через Bearer token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer()

async def get_current_user_local(credentials: HTTPAuthorizationCredentials = Depends(security)):
    from server import db
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Ищем по email, username или wallet_address
        user = await db.users.find_one({
            "$or": [
                {"email": user_id},
                {"username": user_id},
                {"wallet_address": user_id}
            ]
        })
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# --- ЭНДПОИНТЫ ---

# 1. Инициация регистрации - отправка кода на email
@auth_router.post("/register/initiate")
async def register_initiate(data: EmailRegisterInitiate):
    """Start registration - send verification code to email"""
    from server import db
    from email_service import generate_verification_code, store_verification_code, send_verification_email
    
    # Проверка уникальности
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="Этот Username уже занят")
    
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть минимум 6 символов")
    # S4: enforce password strength
    validate_password_strength(data.password)
    # S4: enforce password strength
    validate_password_strength(data.password)
    
    # Хешируем пароль
    password_hash = pwd_context.hash(data.password)
    
    # Генерируем код
    code = generate_verification_code()
    
    # Сохраняем данные
    store_verification_code(data.email, code, data.username, password_hash)
    
    # Отправляем email
    email_sent = send_verification_email(data.email, code, "ru")
    
    if not email_sent:
        # Если SMTP не настроен, создаем пользователя сразу (для разработки)
        import uuid
        avatar = generate_avatar_from_initials(data.username)
        user = {
            "id": str(uuid.uuid4()),
            "username": data.username,
            "display_name": data.username,
            "email": data.email,
            "hashed_password": password_hash,
            "wallet_address": None,
            "raw_address": None,
            "avatar": avatar,
            "balance_ton": 10.0,
            "language": "ru",
            "level": "novice",
            "xp": 0,
            "total_turnover": 0,
            "total_income": 0,
            "plots_owned": [],
            "businesses_owned": [],
            "is_admin": False,
            "email_verified": True,  # Auto-verified if SMTP not configured
            "created_at": datetime.now(timezone.utc),
            "last_login": datetime.now(timezone.utc)
        }
        
        await db.users.insert_one(user)
        token = create_token({"sub": data.email})
        
        return {
            "status": "registered",
            "token": token,
            "type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "avatar": user["avatar"],
                "display_name": user["display_name"],
                "balance_ton": user["balance_ton"]
            },
            "message": "SMTP не настроен - регистрация без верификации"
        }
    
    return {
        "status": "verification_sent",
        "message": "Код подтверждения отправлен на email"
    }

# 1.1 Подтверждение email и завершение регистрации
@auth_router.post("/register/verify")
async def register_verify(data: EmailVerifyCode):
    """Verify email code and complete registration"""
    from server import db
    from email_service import verify_email_code
    import uuid
    
    # Проверяем код
    success, message, user_data = verify_email_code(data.email, data.code)
    
    if not success:
        error_messages = {
            "no_code_requested": "Код не был запрошен. Пройдите регистрацию заново.",
            "code_expired": "Код истёк. Пройдите регистрацию заново.",
            "too_many_attempts": "Слишком много попыток. Пройдите регистрацию заново.",
            "invalid_code": "Неверный код"
        }
        raise HTTPException(status_code=400, detail=error_messages.get(message, message))
    
    # Проверяем еще раз уникальность (на случай если кто-то зарегистрировался пока ждали)
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    if await db.users.find_one({"username": user_data["username"]}):
        raise HTTPException(status_code=400, detail="Этот Username уже занят")
    
    # Создаем пользователя
    avatar = generate_avatar_from_initials(user_data["username"])
    
    user = {
        "id": str(uuid.uuid4()),
        "username": user_data["username"],
        "display_name": user_data["username"],
        "email": data.email,
        "hashed_password": user_data["password_hash"],
        "wallet_address": None,
        "raw_address": None,
        "avatar": avatar,
        "balance_ton": 10.0,
        "language": "ru",
        "level": "novice",
        "xp": 0,
        "total_turnover": 0,
        "total_income": 0,
        "plots_owned": [],
        "businesses_owned": [],
        "is_admin": False,
        "email_verified": True,
        "created_at": datetime.now(timezone.utc),
        "last_login": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user)
    token = create_token({"sub": data.email})
    
    return {
        "token": token,
        "type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "avatar": user["avatar"],
            "display_name": user["display_name"],
            "balance_ton": user["balance_ton"]
        }
    }

# 1.2 Старая регистрация (для совместимости) - теперь редиректит на initiate
@auth_router.post("/register")
async def register(data: EmailRegister):
    from server import db
    import uuid

    # S4: enforce password strength on direct register as well
    validate_password_strength(data.password)

    # Проверка принятия политики
    if hasattr(data, 'agreement_accepted') and not data.agreement_accepted:
        raise HTTPException(status_code=400, detail="Необходимо принять пользовательское соглашение")
    
    # Проверка уникальности
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="Этот Username уже занят")
    
    # Генерируем аватар из инициалов
    avatar = generate_avatar_from_initials(data.username)
    
    device_fp = getattr(data, 'device_fingerprint', '') or ''
    
    user = {
        "id": str(uuid.uuid4()),
        "username": data.username,
        "display_name": data.username,
        "email": data.email,
        "hashed_password": pwd_context.hash(data.password),
        "wallet_address": None,
        "raw_address": None,
        "avatar": avatar,
        "balance_ton": 10.0,  # Стартовый баланс для новых игроков
        "language": "ru",
        "level": "novice",
        "xp": 0,
        "total_turnover": 0,
        "total_income": 0,
        "resources": {},
        "plots_owned": [],
        "businesses_owned": [],
        "is_admin": False,
        "email_verified": False,
        "agreement_accepted": True,
        "device_fingerprint": device_fp,
        "created_at": datetime.now(timezone.utc),
        "last_login": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user)
    token = create_token({"sub": data.email})
    
    return {
        "token": token,
        "type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "avatar": user["avatar"],
            "display_name": user["display_name"],
            "balance_ton": user["balance_ton"]
        }
    }

# 2. Вход через Email или Username
class EmailLoginWith2FA(BaseModel):
    email: str
    password: str
    totp_code: Optional[str] = None  # 2FA код, если требуется

@auth_router.post("/login")
@limiter.limit("10/minute")
async def login(data: EmailLogin, request: Request):
    from server import db

    # S3: brute-force lockout (MongoDB-backed, multi-worker safe)
    client_ip = (request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
                 or (request.client.host if request.client else "unknown"))
    await check_login_lockout_async(data.email, client_ip)

    # Поиск пользователя по email ИЛИ username
    user = await db.users.find_one({
        "$or": [
            {"email": data.email},
            {"username": data.email}  # Если передан username в поле email
        ]
    })

    if not user or not pwd_context.verify(data.password, user.get("hashed_password", "")):
        await record_login_failure_async(data.email, client_ip)
        raise HTTPException(status_code=401, detail="Неверный Email/Username или пароль")

    # Success — reset failure counter
    await record_login_success_async(data.email, client_ip)
    
    # Проверка блокировки
    if user.get("is_blocked"):
        raise HTTPException(
            status_code=403, 
            detail=f"Аккаунт заблокирован. Причина: {user.get('block_reason', 'Нарушение правил')}. Контакты поддержки: support@toncity.com"
        )
    
    # Проверка 2FA если включена
    if user.get("is_2fa_enabled") and user.get("two_factor_secret"):
        # Проверяем, передан ли код 2FA
        totp_code = getattr(data, 'totp_code', None)
        if not totp_code:
            # Возвращаем специальный ответ, требующий 2FA
            return {
                "requires_2fa": True,
                "user_id": user.get("id", str(user.get("_id"))),
                "message": "Требуется код 2FA"
            }
    
    # Создаем токен с email или username (что есть)
    identifier = user.get("email") or user.get("username")
    token = create_token({"sub": identifier})
    
    # Get client info
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "unknown")
    # Parse device from user agent
    device = "Desktop"
    if "Mobile" in user_agent or "Android" in user_agent:
        device = "Mobile"
    elif "iPhone" in user_agent or "iPad" in user_agent:
        device = "iOS"
    elif "Tablet" in user_agent:
        device = "Tablet"
    
    # Parse browser from user agent
    browser = "Unknown"
    ua_lower = user_agent.lower()
    if "edg/" in ua_lower or "edge" in ua_lower:
        browser = "Edge"
    elif "opr/" in ua_lower or "opera" in ua_lower:
        browser = "Opera"
    elif "chrome" in ua_lower and "safari" in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower:
        browser = "Safari"
    elif "yabrowser" in ua_lower:
        browser = "Yandex"
    
    login_entry = {
        "ip": client_ip,
        "device": device,
        "browser": browser,
        "user_agent": user_agent[:200],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    
    # Обновляем last_login и device info + push to login_history (keep last 20)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "last_login": datetime.now(timezone.utc),
                "last_ip": client_ip,
                "last_device": device,
                "last_browser": browser,
                "last_user_agent": user_agent[:200]
            },
            "$push": {
                "login_history": {
                    "$each": [login_entry],
                    "$slice": -20
                }
            }
        }
    )
    
    # Возвращаем токен и информацию о пользователе
    return {
        "token": token,
        "type": "bearer",
        "user": {
            "id": user.get("id", str(user.get("_id"))),
            "username": user.get("username"),
            "email": user.get("email"),
            "wallet_address": user.get("wallet_address"),
            "avatar": user.get("avatar"),
            "display_name": user.get("display_name") or user.get("username"),
            "is_admin": user.get("is_admin", False)
        }
    }

# Вход с 2FA кодом
@auth_router.post("/login-2fa")
async def login_with_2fa(data: EmailLoginWith2FA):
    from server import db
    import pyotp
    
    # Поиск пользователя
    user = await db.users.find_one({
        "$or": [
            {"email": data.email},
            {"username": data.email}
        ]
    })
    
    if not user or not pwd_context.verify(data.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Неверный Email/Username или пароль")
    
    # Проверка 2FA
    if user.get("is_2fa_enabled") and user.get("two_factor_secret"):
        if not data.totp_code:
            raise HTTPException(status_code=400, detail="Требуется код 2FA")
        
        # Проверяем TOTP код
        totp = pyotp.TOTP(user["two_factor_secret"])
        if not totp.verify(data.totp_code, valid_window=1):
            # Проверяем резервные коды
            import hashlib
            code_hash = hashlib.sha256(data.totp_code.upper().encode()).hexdigest()
            backup_codes = user.get("backup_codes", [])
            
            if code_hash in backup_codes:
                # Использован резервный код - удаляем его
                backup_codes.remove(code_hash)
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"backup_codes": backup_codes}}
                )
            else:
                raise HTTPException(status_code=401, detail="Неверный код 2FA")
    
    # Создаем токен
    identifier = user.get("email") or user.get("username")
    token = create_token({"sub": identifier})
    
    # Обновляем last_login
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    return {
        "token": token,
        "type": "bearer",
        "user": {
            "id": user.get("id", str(user.get("_id"))),
            "username": user.get("username"),
            "email": user.get("email"),
            "wallet_address": user.get("wallet_address"),
            "avatar": user.get("avatar"),
            "display_name": user.get("display_name") or user.get("username"),
            "is_admin": user.get("is_admin", False)
        }
    }


# 2.5. Вход/Регистрация через Google OAuth
@auth_router.post("/google")
async def google_auth(data: GoogleAuth):
    """
    Аутентификация через Google OAuth
    Принимает Google ID token от фронтенда
    """
    from server import db
    import uuid
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth not configured. Please add GOOGLE_CLIENT_ID to .env"
        )
    
    try:
        # Верифицируем Google ID token
        idinfo = id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Получаем данные пользователя из Google
        email = idinfo.get('email')
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        google_id = idinfo.get('sub')
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Ищем пользователя по email или google_id
        user = await db.users.find_one({
            "$or": [
                {"email": email},
                {"google_id": google_id}
            ]
        })
        
        if user:
            # Пользователь существует - обновляем данные при необходимости
            updates = {}
            if not user.get("google_id"):
                updates["google_id"] = google_id
            if picture and not user.get("avatar_uploaded"):
                updates["avatar"] = picture
            if not user.get("display_name"):
                updates["display_name"] = name
            
            if updates:
                updates["last_login"] = datetime.now(timezone.utc)
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": updates}
                )
                user.update(updates)
            
        else:
            # Новый пользователь - создаем аккаунт
            # Генерируем уникальный username из email
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
            
            # Используем Google avatar или генерируем из инициалов
            avatar = picture if picture else generate_avatar_from_initials(name or username)
            
            user = {
                "id": str(uuid.uuid4()),
                "username": username,
                "display_name": name or username,
                "email": email,
                "google_id": google_id,
                "hashed_password": None,  # Google users don't have password
                "wallet_address": None,
                "raw_address": None,
                "avatar": avatar,
                "avatar_uploaded": bool(picture),  # Track if using Google avatar
                "balance_ton": 0,
                "balance_ton": 0,
                "language": "ru",
                "level": "novice",
                "xp": 0,
                "total_turnover": 0,
                "total_income": 0,
                "plots_owned": [],
                "businesses_owned": [],
                "is_admin": False,
                "created_at": datetime.now(timezone.utc),
                "last_login": datetime.now(timezone.utc)
            }
            
            await db.users.insert_one(user)
        
        # Создаем токен
        token = create_token({"sub": email})
        
        return {
            "token": token,
            "type": "bearer",
            "user": {
                "id": user.get("id", str(user.get("_id"))),
                "username": user.get("username"),
                "email": user.get("email"),
                "wallet_address": user.get("wallet_address"),
                "avatar": user.get("avatar"),
                "display_name": user.get("display_name")
            }
        }
        
    except ValueError as e:
        # Invalid token
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google auth error: {str(e)}")


# 2.5b. Google OAuth Callback (Authorization Code Flow - works on mobile)
class GoogleCallbackRequest(BaseModel):
    code: str
    redirect_uri: str

@auth_router.post("/google/callback")
async def google_oauth_callback(data: GoogleCallbackRequest):
    """
    Google OAuth callback - exchange authorization code for tokens
    This method works better on mobile devices than One Tap
    """
    import httpx
    import uuid
    from server import db
    
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth not configured. Please add GOOGLE_CLIENT_ID to .env"
        )
    
    try:
        # Exchange authorization code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": data.code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": data.redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                error_data = token_response.json()
                logger.error(f"Google token exchange failed: {error_data}")
                raise HTTPException(status_code=401, detail="Failed to exchange authorization code")
            
            tokens = token_response.json()
            id_token_str = tokens.get("id_token")
            
            if not id_token_str:
                raise HTTPException(status_code=401, detail="No ID token received from Google")
            
            # Verify and decode the ID token
            idinfo = id_token.verify_oauth2_token(
                id_token_str,
                google_requests.Request(),
                GOOGLE_CLIENT_ID
            )
        
        # Get user info from token
        email = idinfo.get('email')
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        google_id = idinfo.get('sub')
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Find or create user
        user = await db.users.find_one({
            "$or": [
                {"email": email},
                {"google_id": google_id}
            ]
        })
        
        if user:
            # Update existing user
            updates = {"last_login": datetime.now(timezone.utc).isoformat()}
            if not user.get("google_id"):
                updates["google_id"] = google_id
            if picture and not user.get("avatar_uploaded"):
                updates["avatar"] = picture
            if not user.get("display_name") and name:
                updates["display_name"] = name
            
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            
            token = create_token(data={"sub": email})
            
            return {
                "status": "ok",
                "token": token,
                "user": {
                    "id": user.get("id", str(user.get("_id"))),
                    "username": user.get("username"),
                    "email": email,
                    "avatar": user.get("avatar", picture),
                    "is_admin": user.get("is_admin", False)
                }
            }
        else:
            # Create new user
            username = name.split()[0] if name else email.split("@")[0]
            avatar = picture or generate_avatar_from_initials(name or username)
            
            new_user = {
                "id": str(uuid.uuid4()),
                "username": username,
                "display_name": name,
                "email": email,
                "google_id": google_id,
                "hashed_password": None,
                "avatar": avatar,
                "avatar_uploaded": bool(picture),
                "balance_ton": 0.0,
                "level": 1,
                "xp": 0,
                "is_admin": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": datetime.now(timezone.utc).isoformat(),
                "email_verified": True,
                "plots_owned": [],
                "businesses_owned": []
            }
            
            await db.users.insert_one(new_user)
            
            token = create_token(data={"sub": email})
            
            return {
                "status": "ok",
                "token": token,
                "user": {
                    "id": new_user["id"],
                    "username": username,
                    "email": email,
                    "avatar": avatar,
                    "is_admin": False
                }
            }
            
    except httpx.RequestError as e:
        logger.error(f"Google OAuth network error: {e}")
        raise HTTPException(status_code=502, detail="Failed to connect to Google")
    except ValueError as e:
        logger.error(f"Google token validation error: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        raise HTTPException(status_code=500, detail=f"Auth error: {str(e)}")


# 2.6. Вход через Emergent Google OAuth (альтернативный метод)
class EmergentSessionRequest(BaseModel):
    session_id: str

@auth_router.post("/google/emergent")
async def emergent_google_auth(data: EmergentSessionRequest):
    """
    Аутентификация через Emergent Google OAuth
    Принимает session_id после редиректа от https://auth.emergentagent.com
    """
    import httpx
    from server import db
    
    try:
        # Обмениваем session_id на данные пользователя
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": data.session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")
            
            user_data = response.json()
        
        email = user_data.get("email")
        name = user_data.get("name", "")
        picture = user_data.get("picture", "")
        google_id = user_data.get("id")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided")
        
        # Ищем пользователя по email или google_id
        user = await db.users.find_one({
            "$or": [
                {"email": email},
                {"google_id": google_id}
            ]
        })
        
        if user:
            # Обновляем данные существующего пользователя
            updates = {"last_login": datetime.now(timezone.utc).isoformat()}
            if not user.get("google_id") and google_id:
                updates["google_id"] = google_id
            if picture and not user.get("avatar_uploaded"):
                updates["avatar"] = picture
            
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": updates}
            )
            
            # Создаем токен
            token = create_token(data={"sub": email})
            
            return {
                "status": "ok",
                "token": token,
                "user": {
                    "id": user.get("id", str(user.get("_id"))),
                    "username": user.get("username"),
                    "email": email,
                    "avatar": user.get("avatar", picture),
                    "is_admin": user.get("is_admin", False)
                }
            }
        else:
            # Создаем нового пользователя
            import uuid
            
            # Генерируем username из email или имени
            username = name.split()[0] if name else email.split("@")[0]
            avatar = picture or generate_avatar_from_initials(name or username)
            
            new_user = {
                "id": str(uuid.uuid4()),
                "username": username,
                "display_name": name,
                "email": email,
                "google_id": google_id,
                "hashed_password": None,
                "avatar": avatar,
                "avatar_uploaded": bool(picture),
                "balance_ton": 0.0,
                "level": 1,
                "xp": 0,
                "is_admin": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": datetime.now(timezone.utc).isoformat(),
                "email_verified": True,  # Google already verified
                "plots_owned": [],
                "businesses_owned": []
            }
            
            await db.users.insert_one(new_user)
            
            token = create_token(data={"sub": email})
            
            return {
                "status": "ok",
                "token": token,
                "user": {
                    "id": new_user["id"],
                    "username": username,
                    "email": email,
                    "avatar": avatar,
                    "is_admin": False
                }
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to contact auth server: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth error: {str(e)}")

# 3. Проверка/Вход через Кошелек (Wallet Check)
@auth_router.post("/wallet-check")
async def wallet_check(data: WalletAuth):
    from server import db
    user = await db.users.find_one({"wallet_address": data.address})
    
    if not user:
        # Если юзера нет, создаем "черновик" без Username
        new_user = {
            "username": None,
            "email": None,
            "wallet_address": data.address,
            "balance_ton": 0,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
        token = create_token({"sub": data.address})
        return {"status": "need_username", "token": token}
    
    # Если юзер есть, но ник почему-то не установлен
    if not user.get("username"):
        token = create_token({"sub": data.address})
        return {"status": "need_username", "token": token}
    
    # Обычный вход
    token = create_token({"sub": data.address})
    return {"status": "ok", "token": token}

# 4. Установка Username (вызывается в модалке после Wallet/Google входа)
@auth_router.post("/set-username")
async def set_username(data: UsernameUpdate, token: str):
    from server import db
    # Получаем юзера по временному токену
    current_user = await get_current_user_local(token)
    
    # Проверяем, свободен ли ник
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="Этот ник уже занят")
    
    if len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Ник слишком короткий")

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"username": data.username}}
    )
    
    return {"status": "success"}


# 5. Настройки пользователя
class UpdateUsernameRequest(BaseModel):
    username: str

class UpdateEmailRequest(BaseModel):
    email: EmailStr
    password: str  # Требуется текущий пароль для подтверждения

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class LinkWalletRequest(BaseModel):
    wallet_address: str

class UploadAvatarRequest(BaseModel):
    avatar_data: str  # Base64 encoded image or URL

@auth_router.put("/update-username")
async def update_username(data: UpdateUsernameRequest, current_user: dict = Depends(get_current_user_local)):
    """Изменение username"""
    from server import db
    
    if len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Username слишком короткий (минимум 3 символа)")
    
    # Проверяем уникальность
    existing = await db.users.find_one({"username": data.username})
    if existing and str(existing.get("_id")) != str(current_user.get("_id")):
        raise HTTPException(status_code=400, detail="Этот username уже занят")
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"username": data.username, "display_name": data.username}}
    )
    
    return {"status": "success", "username": data.username}

@auth_router.put("/update-email")
async def update_email(data: UpdateEmailRequest, current_user: dict = Depends(get_current_user_local)):
    """Изменение email (требуется пароль)"""
    from server import db
    
    # Проверка: у пользователя должен быть пароль (не Google auth)
    if not current_user.get("hashed_password"):
        raise HTTPException(status_code=400, detail="Невозможно изменить email для аккаунта Google")
    
    # Проверяем текущий пароль
    if not pwd_context.verify(data.password, current_user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Неверный пароль")
    
    # Проверяем уникальность email
    existing = await db.users.find_one({"email": data.email})
    if existing and str(existing.get("_id")) != str(current_user.get("_id")):
        raise HTTPException(status_code=400, detail="Этот email уже используется")
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"email": data.email}}
    )
    
    return {"status": "success", "email": data.email}

@auth_router.put("/update-password")
async def update_password(data: UpdatePasswordRequest, current_user: dict = Depends(get_current_user_local)):
    """Изменение пароля"""
    from server import db
    
    # Проверка: у пользователя должен быть пароль (не Google auth)
    if not current_user.get("hashed_password"):
        raise HTTPException(status_code=400, detail="Невозможно установить пароль для аккаунта Google")
    
    # Проверяем текущий пароль
    if not pwd_context.verify(data.current_password, current_user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Неверный текущий пароль")
    
    # Хешируем новый пароль
    new_hashed = pwd_context.hash(data.new_password)
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"hashed_password": new_hashed}}
    )
    
    return {"status": "success"}

@auth_router.post("/link-wallet")
async def link_wallet(data: LinkWalletRequest, current_user: dict = Depends(get_current_user_local)):
    """Привязка кошелька к аккаунту"""
    from server import db, to_raw
    from datetime import datetime, timezone
    
    # Проверяем, не привязан ли кошелек к другому аккаунту
    raw_address = to_raw(data.wallet_address)
    existing = await db.users.find_one({
        "$or": [
            {"wallet_address": data.wallet_address},
            {"raw_address": raw_address}
        ]
    })
    
    if existing and str(existing.get("_id")) != str(current_user.get("_id")):
        raise HTTPException(status_code=400, detail="Этот кошелек уже привязан к другому аккаунту")
    
    # IMPORTANT: Set wallet_linked_at to NOW to ignore old transactions (Problem #4 fix)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "wallet_address": data.wallet_address,
            "raw_address": raw_address,
            "wallet_linked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success", "wallet_address": data.wallet_address}

@auth_router.post("/unlink-wallet")
async def unlink_wallet(current_user: dict = Depends(get_current_user_local)):
    """Отвязка кошелька от аккаунта"""
    from server import db
    
    # Проверяем, есть ли у пользователя email (иначе он потеряет доступ к аккаунту)
    if not current_user.get("email") and not current_user.get("hashed_password"):
        raise HTTPException(
            status_code=400, 
            detail="Невозможно отвязать кошелек - у вас нет email. Сначала добавьте email в настройках."
        )
    
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$unset": {
            "wallet_address": "",
            "raw_address": ""
        }}
    )
    
    return {"status": "success", "message": "Кошелек отвязан"}

@auth_router.post("/upload-avatar")
async def upload_avatar(data: UploadAvatarRequest, current_user: dict = Depends(get_current_user_local)):
    """Загрузка пользовательского аватара"""
    from server import db
    
    # В реальном приложении здесь была бы загрузка на S3/CDN
    # Пока просто сохраняем base64/URL
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "avatar": data.avatar_data,
            "avatar_uploaded": True
        }}
    )
    
    return {"status": "success", "avatar": data.avatar_data}



# ==================== PASSWORD RESET ====================

class RequestPasswordResetRequest(BaseModel):
    email: EmailStr

class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

@auth_router.post("/request-password-reset")
async def request_password_reset(data: RequestPasswordResetRequest):
    """Запрос сброса пароля - отправляет код на email"""
    from server import db
    from email_service import generate_reset_code, store_reset_code, send_email_with_code_async
    
    # Проверяем существование пользователя
    user = await db.users.find_one({"email": data.email})
    
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    
    # Проверяем что у пользователя есть пароль (не только wallet/google auth)
    if not user.get("hashed_password"):
        raise HTTPException(status_code=400, detail="no_password_account")
    
    # Генерируем и сохраняем код
    code = generate_reset_code()
    store_reset_code(data.email, code)
    
    # Отправляем email (используем async версию)
    language = user.get("language", "ru")
    email_sent = await send_email_with_code_async(data.email, code, language, "reset")
    
    if not email_sent:
        raise HTTPException(status_code=500, detail="email_send_failed")
    
    return {"status": "success", "message": "code_sent"}

@auth_router.post("/verify-reset-code")
async def verify_reset_code_endpoint(data: VerifyResetCodeRequest):
    """Проверка кода сброса (без смены пароля)"""
    from email_service import verify_reset_code, store_reset_code, generate_reset_code
    import logging
    logger = logging.getLogger(__name__)
    
    # Получаем текущий код для проверки без удаления
    from email_service import reset_codes
    email_lower = data.email.lower()
    
    # Strip whitespace only, keep case
    received_code = data.code.strip()
    
    logger.info(f"Verify code attempt for {email_lower}, received code: '{received_code}'")
    
    if email_lower not in reset_codes:
        logger.warning(f"No code found for {email_lower}")
        raise HTTPException(status_code=400, detail="no_code_requested")
    
    stored = reset_codes[email_lower]
    stored_code = stored['code']
    logger.info(f"Stored code for {email_lower}: '{stored_code}'")
    
    from datetime import datetime, timezone
    if datetime.now(timezone.utc) > stored["expires_at"]:
        del reset_codes[email_lower]
        raise HTTPException(status_code=400, detail="code_expired")
    
    if stored["attempts"] >= 5:
        del reset_codes[email_lower]
        raise HTTPException(status_code=400, detail="too_many_attempts")
    
    if stored_code != received_code:
        logger.warning(f"Code mismatch: stored='{stored_code}' vs received='{received_code}'")
        stored["attempts"] += 1
        raise HTTPException(status_code=400, detail="invalid_code")
    
    # Код верный, но не удаляем его - пользователь еще будет менять пароль
    return {"status": "success", "valid": True}

@auth_router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Сброс пароля с использованием кода"""
    from server import db
    from email_service import verify_reset_code
    
    # Проверяем код
    success, message = verify_reset_code(data.email, data.code)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Проверяем длину нового пароля
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="password_too_short")
    
    # Обновляем пароль
    new_hash = pwd_context.hash(data.new_password)
    
    result = await db.users.update_one(
        {"email": data.email},
        {"$set": {"hashed_password": new_hash}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="user_not_found")
    
    return {"status": "success", "message": "password_changed"}


# ==================== EMAIL CHANGE WITH VERIFICATION ====================

# In-memory storage for email change codes
email_change_codes = {}

class EmailChangeStartRequest(BaseModel):
    pass  # No body needed, uses current user

class EmailChangeVerifyOldRequest(BaseModel):
    code: str

class EmailChangeSendNewRequest(BaseModel):
    new_email: EmailStr
    old_code: str

class EmailChangeCompleteRequest(BaseModel):
    new_email: EmailStr
    new_code: str
    old_code: str


@auth_router.post("/email-change/start")
async def email_change_start(current_user = Depends(get_current_user_local)):
    """Step 1: Send verification code to current email"""
    from server import db
    from email_service import send_email_with_code_async
    import random
    
    # current_user is a dict, not an object
    user_email = current_user.get("email")
    user_id = current_user.get("id")
    
    user = await db.users.find_one(
        {"$or": [{"email": user_email}, {"id": user_id}]},
        {"_id": 0}
    )
    
    if not user or not user.get("email"):
        raise HTTPException(status_code=400, detail="Email не найден")
    
    # Check if email was changed recently (7 days limit)
    last_email_change = user.get("last_email_change")
    if last_email_change:
        if isinstance(last_email_change, str):
            last_email_change = datetime.fromisoformat(last_email_change.replace('Z', '+00:00'))
        days_since_change = (datetime.now(timezone.utc) - last_email_change).days
        if days_since_change < 7:
            days_left = 7 - days_since_change
            raise HTTPException(status_code=400, detail=f"Смена email доступна через {days_left} дн. (раз в 7 дней)")
    
    email = user["email"]
    code = ''.join(random.choices('0123456789', k=6))
    
    # Store code
    email_change_codes[email.lower()] = {
        "old_code": code,
        "new_code": None,
        "new_email": None,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15),
        "user_id": user.get("id")
    }
    
    # Send email using async function
    try:
        email_sent = await send_email_with_code_async(email, code, user.get("language", "ru"), "verification")
        if not email_sent:
            logger.warning(f"Email change code for {email}: {code} (email not sent)")
    except Exception as e:
        logger.error(f"Failed to send email change code: {e}")
        logger.info(f"Email change code for {email}: {code}")
    
    return {"status": "success", "message": "Код отправлен на вашу почту"}


@auth_router.post("/email-change/verify-old")
async def email_change_verify_old(data: EmailChangeVerifyOldRequest, current_user = Depends(get_current_user_local)):
    """Step 2: Verify code from old email"""
    from server import db
    
    user_email = current_user.get("email")
    user_id = current_user.get("id")
    
    user = await db.users.find_one(
        {"$or": [{"email": user_email}, {"id": user_id}]},
        {"_id": 0}
    )
    
    if not user or not user.get("email"):
        raise HTTPException(status_code=400, detail="Email не найден")
    
    email = user["email"].lower()
    
    stored = email_change_codes.get(email)
    if not stored:
        raise HTTPException(status_code=400, detail="Код не найден. Запросите новый")
    
    if datetime.now(timezone.utc) > stored["expires_at"]:
        del email_change_codes[email]
        raise HTTPException(status_code=400, detail="Код истёк. Запросите новый")
    
    if stored["old_code"] != data.code:
        raise HTTPException(status_code=400, detail="Неверный код")
    
    return {"status": "success", "message": "Код подтверждён"}


@auth_router.post("/email-change/send-new")
async def email_change_send_new(data: EmailChangeSendNewRequest, current_user = Depends(get_current_user_local)):
    """Step 3: Send verification code to new email"""
    from server import db
    from email_service import send_email_with_code_async
    import random
    
    user_email = current_user.get("email")
    user_id = current_user.get("id")
    
    user = await db.users.find_one(
        {"$or": [{"email": user_email}, {"id": user_id}]},
        {"_id": 0}
    )
    
    if not user or not user.get("email"):
        raise HTTPException(status_code=400, detail="Email не найден")
    
    email = user["email"].lower()
    
    # Verify old code first
    stored = email_change_codes.get(email)
    if not stored or stored["old_code"] != data.old_code:
        raise HTTPException(status_code=400, detail="Сначала подтвердите текущий email")
    
    # Check if new email is already used
    existing = await db.users.find_one({"email": data.new_email})
    if existing:
        raise HTTPException(status_code=400, detail="Этот email уже используется")
    
    # Generate code for new email
    new_code = ''.join(random.choices('0123456789', k=6))
    stored["new_code"] = new_code
    stored["new_email"] = data.new_email
    stored["expires_at"] = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Send email to new address
    try:
        email_sent = await send_email_with_code_async(data.new_email, new_code, user.get("language", "ru"), "verification")
        if not email_sent:
            logger.warning(f"Email change code for {data.new_email}: {new_code} (email not sent)")
    except Exception as e:
        logger.error(f"Failed to send new email code: {e}")
        logger.info(f"Email change code for {data.new_email}: {new_code}")
    
    return {"status": "success", "message": "Код отправлен на новую почту"}


@auth_router.post("/email-change/complete")
async def email_change_complete(data: EmailChangeCompleteRequest, current_user = Depends(get_current_user_local)):
    """Step 4: Complete email change"""
    from server import db
    
    user_email = current_user.get("email")
    user_id = current_user.get("id")
    
    user = await db.users.find_one(
        {"$or": [{"email": user_email}, {"id": user_id}]},
        {"_id": 0}
    )
    
    if not user or not user.get("email"):
        raise HTTPException(status_code=400, detail="Email не найден")
    
    email = user["email"].lower()
    
    stored = email_change_codes.get(email)
    if not stored:
        raise HTTPException(status_code=400, detail="Процесс смены email не найден")
    
    if datetime.now(timezone.utc) > stored["expires_at"]:
        del email_change_codes[email]
        raise HTTPException(status_code=400, detail="Время истекло. Начните заново")
    
    if stored["old_code"] != data.old_code:
        raise HTTPException(status_code=400, detail="Неверный код старой почты")
    
    if stored["new_code"] != data.new_code:
        raise HTTPException(status_code=400, detail="Неверный код новой почты")
    
    if stored["new_email"] != data.new_email:
        raise HTTPException(status_code=400, detail="Email не совпадает")
    
    # Update email in database
    result = await db.users.update_one(
        {"email": user["email"]},
        {"$set": {
            "email": data.new_email, 
            "email_verified": True,
            "last_email_change": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Не удалось обновить email")
    
    # Clean up
    del email_change_codes[email]
    
    return {"status": "success", "message": "Email успешно изменён"}
