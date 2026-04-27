# TON City 2.1 — PRD

## Original problem statement
> Клонировать https://github.com/SaleXPetROV/TON_City_2.1.git, запустить проект, создать 2 тестовых пользователя (admin + player).

## Stack
- Backend: FastAPI + Motor/MongoDB + APScheduler + TON SDK + httpx
- Frontend: React (CRA+craco) + TailwindCSS + shadcn/ui + TonConnect + FingerprintJS OSS + Cloudflare Turnstile
- 8 языков i18n (en, ru, es, zh, fr, de, ja, ko)

## Timeline
- 27 Apr 2026 — setup (repo + deps + 2 seed users)
- 27 Apr 2026 — Iteration 1: Full E2E testing (37/37 backend pass, все 22 frontend роута работают)
- 27 Apr 2026 — Iteration 2: 5 UI доработок (i18n Landing, sidebar a11y, credit btn, leaderboard API fix, mobile filter)
- 27 Apr 2026 — Iteration 3: sidebar animation + leaderboard by trading + anti-multi-account (Fingerprint + IPQS)
- 27 Apr 2026 — Iteration 4: IPQS key + Google OAuth keys + Connect Wallet redesign
- 27 Apr 2026 — Iteration 5: Google auth fixes + Passkey empty-state removed + IPQS replaced with Cloudflare Turnstile

## Current state (after iteration 5)
- **Credentials** сохранены в `/app/memory/test_credentials.md`.
- **Auth**: email, Google OAuth (ключи в env — нужно добавить preview URL в Google Cloud Console → Authorized origins), TonConnect wallet.
- **Anti-fraud stack**:
  - **FingerprintJS OSS** (@fingerprintjs/fingerprintjs v5.2.0) — локальный visitor_id отправляется на register/login/withdraw.
  - **Cloudflare Turnstile** (non-interactive / invisible) — токен верифицируется через `challenges.cloudflare.com/turnstile/v0/siteverify`; `TURNSTILE_SECRET_KEY` в backend/.env, `REACT_APP_TURNSTILE_SITE_KEY` в frontend/.env. Действие: register/login/withdraw.
  - **IPQS полностью удалён** (по запросу пользователя). `antifraud.py` переписан на Turnstile + FingerprintJS.
  - **Admin раздел «Мульти-аккаунты»**: бейдж статус Turnstile, счётчики ✓/✗, группы visitor_id, IP группы, провалы Turnstile (с error codes).
- **Leaderboard**: 3 вкладки — By Balance / By Income / By Trading (агрегация по `transactions` collection).
- **Sidebar**: расширяется плавно (text появляется через 180ms, скрывается мгновенно перед свёртыванием), a11y (aria-label/role/tabIndex/title/focus-ring).
- **CreditPage**: кнопка «Взять кредит» в empty-state или под последним активным кредитом.
- **SecurityPage — Passkey**: пустой блок «Нет зарегистрированных устройств» убран; список показывается только если есть зарегистрированные ключи.
- **GoogleCallback**: fixed double toast (useRef guard от StrictMode double-effect), все строки на 8 языках через t().
- **TransactionHistory**: mobile фильтр full-width с 16px отступами.
- **Connect Wallet** кнопка: единый TON-синий градиент (#0098ea → #0079c0) + shine overlay + hover-анимация.

## Pending (требует действий пользователя)
- **Google Cloud Console**: добавить `https://ton-builder.preview.emergentagent.com` в Authorized JavaScript origins / redirect URIs (иначе Google login упадёт с `redirect_uri_mismatch`).
- **TON mainnet wallet mnemonic** / **Telegram bot token** / **Email SMTP (Resend/SendGrid)** — по запросу пользователя НЕ конфигурируются.
- **Deploy в prod** — не требуется.

## Backlog
- Tailwind CDN → compiled CSS (prod warning)
- bcrypt 4.x + passlib 1.7.4 warning в логах (cosmetic)
- Опционально: автоблокировка withdraw при подряд провалах Turnstile
- Опционально: шифрование мнемоник админ-кошельков в MongoDB через Fernet
