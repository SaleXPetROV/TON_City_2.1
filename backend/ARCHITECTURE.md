# TON City Builder - Backend Architecture

## Текущая структура

Проект использует гибридную структуру: основной функционал в `server.py`, с модулями в `core/` для новых компонентов.

### Структура файлов

```
/app/backend/
├── server.py              <- Главный файл (8600+ строк, все API routes)
├── core/                  <- Модули ядра (новая структура)
│   ├── __init__.py        <- Экспорты
│   ├── database.py        <- MongoDB подключение
│   ├── config.py          <- Константы и конфигурация
│   ├── models.py          <- Pydantic модели
│   ├── helpers.py         <- Вспомогательные функции
│   ├── dependencies.py    <- FastAPI dependencies (auth)
│   └── websocket.py       <- WebSocket manager
├── routes/                <- Модули роутов (для новых features)
│   ├── __init__.py
│   └── withdrawal.py      <- Пример модульного роута
├── security/              <- 2FA и безопасность
│   ├── security_router.py
│   ├── totp_handler.py
│   ├── passkey_handler.py
│   └── withdrawal_handler.py
├── auth_handler.py        <- Email/Wallet аутентификация
├── business_config.py     <- Конфигурация бизнесов V2.0
├── business_model.py      <- Финансовая модель
├── business_system.py     <- Система бизнесов
├── game_systems.py        <- Игровые системы
├── ton_island.py          <- Генератор карты
├── ton_integration.py     <- TON блокчейн интеграция
├── chat_handler.py        <- Чат система
├── transaction_history.py <- История транзакций
├── background_tasks.py    <- Фоновые задачи
├── payment_monitor.py     <- Мониторинг платежей
└── contract_deployer.py   <- Деплоер контрактов
```

## server.py - Навигация по секциям

| Строки | Раздел | Описание |
|--------|--------|----------|
| 1-100 | Импорты | Все зависимости и модули |
| 100-210 | Инициализация | App, роутеры, WebSocket manager |
| 210-470 | Константы | ZONES, BUSINESS_TYPES, RESOURCE_PRICES |
| 470-670 | Модели | Pydantic модели |
| 670-720 | Dependencies | get_current_user, get_admin_user |
| 720-980 | Leaderboard | /api/leaderboard |
| 980-1300 | Island Routes | /api/island, /api/island/buy, /api/island/build |
| 1300-1500 | Business Info | /api/businesses/my, /api/businesses/{id} |
| 1500-1700 | Patronage | Патронажная система |
| 1700-1900 | Warehouse | Склад и хранение |
| 1900-2150 | Banking | Банки, кредиты (2FA!) |
| 2150-2700 | Cities | Управление городами |
| 2700-3100 | Plots | Управление участками |
| 3100-3500 | Businesses | Строительство, апгрейд |
| 3500-4100 | Trade | Торговля ресурсами |
| 4100-4700 | Marketplace | Маркетплейс |
| 4700-4850 | Withdrawal | Вывод средств (2FA!) |
| 4850-5400 | Stats | Статистика |
| 5400-6100 | Economy V2 | Экономические эндпоинты |
| 6100-6700 | Admin | Администрирование |
| 6700-7600 | Contract | Деплоер контрактов |
| 7600-8100 | Credit | Кредитная система |
| 8100-8400 | Telegram | Telegram интеграция |
| 8400-8650 | Startup | События и инициализация |

## 2FA Защита

Вывод средств защищён 2FA (TOTP). Проверка в:
- `server.py:1940-1960` - Instant withdrawal
- `server.py:4720-4740` - Standard withdrawal
- `security/withdrawal_handler.py` - Модуль безопасности

```python
# Логика проверки 2FA
is_2fa_enabled = user.get("is_2fa_enabled", False)
has_passkey = bool(user.get("passkeys"))

if not is_2fa_enabled and not has_passkey:
    raise HTTPException(403, "Для вывода необходимо включить 2FA")

if is_2fa_enabled and totp_secret:
    if not totp.verify(totp_code, valid_window=3):
        raise HTTPException(400, "Неверный код 2FA")
```

## Как добавлять новый функционал

### 1. Для нового API endpoint:
```python
# В server.py добавить:
@api_router.post("/new-feature")
async def new_feature(current_user: User = Depends(get_current_user)):
    # код
    pass
```

### 2. Для модульного роута:
```python
# Создать routes/new_feature.py
from fastapi import APIRouter, Depends
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/new-feature", tags=["new-feature"])

@router.get("/")
async def get_feature(current_user = Depends(get_current_user)):
    pass

# В server.py добавить:
from routes.new_feature import router as new_feature_router
app.include_router(new_feature_router)
```

## Тестовые пользователи

| Email | Password | Admin | Balance |
|-------|----------|-------|---------|
| user@test.com | test123 | No | Variable |
| admin@test.com | test123 | Yes | 1000 TON |

Создаются скриптом: `python create_test_users_v2.py`

## Зависимости между модулями

```
server.py
├── core/ (database, models, helpers)
├── auth_handler.py
├── security/
├── business_config.py
├── game_systems.py
├── ton_island.py
├── ton_integration.py
├── chat_handler.py
├── business_system.py
├── transaction_history.py
├── background_tasks.py
└── payment_monitor.py
```
