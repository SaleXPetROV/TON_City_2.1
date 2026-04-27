# TON City 2.1 — PRD

## Original problem statement
> вот мой проект: https://github.com/SaleXPetROV/TON_City_2.1.git, скопируй и запусти его.
> Создай 2 тестовых пользователя 1 из которых админ, почта sanyanazarov212@gmail.com, пароль Qetuyrwioo.
> Данные второго на твоё усмотрение.

## Summary
TON City Builder — браузерная экономическая стратегия с интеграцией TON blockchain (FastAPI + MongoDB + React). Клонирован из GitHub, развёрнут в preview.

## Stack
- Backend: FastAPI (uvicorn), motor/MongoDB, JWT auth, APScheduler (фоновые задачи), TON SDK, модули: core/, routes/, security/, business_system, game_systems, chat_handler.
- Frontend: React (CRA + craco), TailwindCSS, shadcn/ui, TonConnect, многоязычность (8 языков).
- DB: MongoDB (local), DB name `test_database`.

## What's been implemented (27 Apr 2026)
- Репозиторий склонирован в `/app`, исходный `.env` сохранён (MONGO_URL, REACT_APP_BACKEND_URL, DB_NAME).
- `pip install -r requirements.txt` выполнен; `yarn install` выполнен.
- Supervisor перезапущен — backend и frontend в статусе RUNNING.
- `python seed_users.py` — созданы 2 пользователя:
  - Admin: `sanyanazarov212@gmail.com` / `Qetuyrwioo` (is_admin=true)
  - Player: `testuser@example.com` / `Test12345!`
- Проверен `/api/auth/login` для обоих — выдаются JWT токены, is_admin корректно проставлен.
- Главная страница (preview URL) успешно загружается.
- Детали доступа: `/app/memory/test_credentials.md`.

## Pending / не запрашивалось
- 3rd-party ключи (Telegram bot, TON mainnet wallet mnemonic, SMTP/Resend, Stripe) — по запросу пользователя НЕ конфигурировать.
- Деплой (prod) — не требуется.
- Полное E2E тестирование всех функций — по запросу пользователя будет выполнено отдельно.

## Backlog / Next
- P0: провести полное тестирование (см. предложение в finish).
- P1: по мере необходимости — донастройка Telegram bot / TON mainnet wallet.
