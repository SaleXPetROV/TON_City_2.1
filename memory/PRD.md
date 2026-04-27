# TON City 2.1 — PRD

## Original problem statement
> Клонировать https://github.com/SaleXPetROV/TON_City_2.1.git, запустить проект, создать 2 тестовых пользователя (admin + player).

## Stack
- Backend: FastAPI + Motor/MongoDB + APScheduler + TON SDK + httpx (IPQS)
- Frontend: React (CRA + craco) + TailwindCSS + shadcn/ui + TonConnect + FingerprintJS OSS
- 8 языков i18n (en, ru, es, zh, fr, de, ja, ko)

## What's been implemented

### 27 Apr 2026 — Setup
- Репозиторий склонирован в `/app`; `pip install -r requirements.txt` + `yarn install`; supervisor RUNNING.
- Создано 2 пользователя через `seed_users.py`:
  - Admin: `sanyanazarov212@gmail.com` / `Qetuyrwioo`
  - Player: `testuser@example.com` / `Test12345!`

### 27 Apr 2026 — Full E2E Testing (Iteration 1)
Backend pytest (37/37 PASS): Auth, Tutorial guard + rollback + 13 steps, Cities/Plots, TON Island, Businesses, Patronage V2, Market, Banking, Credits, Withdrawal, 2FA, Admin guards, Leaderboard, Stats, Notifications, Buffs, Sprites, Health.
Frontend: все 22 роута рендерятся, JWT persist, mobile responsive, tutorial welcome modal, язык-свитчер.

### 27 Apr 2026 — Iteration 2 (5 доработок)
1. i18n fix в LandingPage (calculatorCard/p2pTradingCard/myBusinessesCard/leaderboardCard).
2. Sidebar a11y (aria-label/role/tabIndex/title/focus-ring).
3. CreditPage — кнопка «Взять кредит» перенесена в empty state / под последним кредитом.
4. Leaderboard API fix — `{players: [...]}` + поддержка sort_by.
5. TransactionHistory mobile — filter full-width с 16px отступами.

### 27 Apr 2026 — Iteration 3 (3 доработки)
1. **Sidebar animation (desktop):** `showLabels` state с setTimeout(180ms) — текст появляется после раскрытия панели и мгновенно скрывается перед её сворачиванием. Устраняет «вылет» текста за край.
2. **Leaderboard «By Trading»:** новая вкладка с сортировкой по торговой активности (sum of buy+sell across all businesses). Backend `routes/leaderboard.py` агрегирует из `transactions` collection по `tx_type in [trade_resource, market_purchase]`. Переводы на все 8 языков.
3. **Anti-multi-accounting v2:**
   - Frontend: `@fingerprintjs/fingerprintjs` OSS v5.2.0, helper `src/lib/fingerprint.js`, visitor_id отправляется в `/auth/login`, `/auth/register/initiate`, `/auth/register/verify`, `/auth/login-2fa`, `/withdraw`, `/withdraw/instant`.
   - Backend: новый модуль `antifraud.py` — `record_event()` сохраняет событие в MongoDB collection `fingerprints`, `check_ip_reputation()` вызывает IPQualityScore API с 24h кэшем. В dry-run режиме (пустой `IPQS_API_KEY`) пропускает API вызов, сохраняет IP+visitor_id+UA.
   - `IPQS_API_KEY=""` в `backend/.env` (пустое — ждёт ключ от пользователя).
   - Admin endpoint `/api/admin/multi-accounts` полностью переписан: возвращает `visitor_groups` (>1 аккаунт на одном устройстве), `ip_groups` (>1 аккаунт с одного IP + VPN/Tor/Proxy flags), `high_risk_events` (fraud_score≥75).
   - Frontend `AdminPage.jsx` раздел «Мульти-аккаунты» полностью переделан: badge статус IPQS (enabled/dry-run), карточки групп с IPQS флагами (TOR/VPN/PROXY), country code, ISP, fraud score.
   - Старая реализация (группировка по `last_ip` + `last_device`) удалена полностью.
   - **Проверено**: 2 логина с одинаковым `visitor_id` создают группу, endpoint возвращает корректные данные, UI отображает группы и статус IPQS.

## Pending / ожидает действий пользователя
- IPQS_API_KEY — пользователь получит ключ на https://www.ipqualityscore.com/create-account и пришлёт. Сейчас dry-run.
- 3rd-party (Telegram bot, TON mainnet wallet, SMTP/Resend, Stripe) — по запросу пользователя НЕ конфигурируются.
- Deploy в prod — не требуется.

## Backlog
- Подставить IPQS_API_KEY когда пользователь пришлёт, рестартнуть backend.
- Google OAuth кнопка (скрыть или настроить client_id).
- Tailwind CDN → compiled CSS (production warning).
- Опционально: rate-limit IPQS через более агрессивный кэш при достижении лимита 5000/мес.
