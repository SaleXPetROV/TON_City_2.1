# TON City 2.1 — PRD

## Original problem statement
> Клонировать https://github.com/SaleXPetROV/TON_City_2.1.git, запустить проект, создать 2 тестовых пользователя (admin + player).

## Stack
- Backend: FastAPI + Motor/MongoDB + APScheduler + TON SDK
- Frontend: React (CRA + craco) + TailwindCSS + shadcn/ui + TonConnect
- 8 языков i18n (en, ru, es, zh, fr, de, ja, ko)

## What's been implemented

### 27 Apr 2026 — Setup
- Репозиторий склонирован в `/app`; `pip install -r requirements.txt` + `yarn install`; supervisor RUNNING.
- Создано 2 пользователя через `seed_users.py`:
  - Admin: `sanyanazarov212@gmail.com` / `Qetuyrwioo`
  - Player: `testuser@example.com` / `Test12345!`

### 27 Apr 2026 — Full E2E Testing
- Backend pytest-сьют (37/37 PASS, 100%): Auth, Tutorial guard + rollback + 13 шагов, Cities/Plots, TON Island, Businesses, Patronage V2, Market, Banking, Credits, Withdrawal, 2FA, Admin guards, Leaderboard, Stats, Notifications, Buffs, Sprites, Health.
- Frontend: все 22 роута рендерятся корректно, JWT persist, mobile responsive, tutorial welcome modal, язык-свитчер.

### 27 Apr 2026 — Доработки (Iteration 2)
1. **i18n fix (LandingPage):** заменены RU‑хардкоды "Калькулятор/P2P Торговля/Мои бизнесы/Рейтинг" на `t('calculatorCard')` и т.д. — теперь корректно переводится на все 8 языков.
2. **Sidebar accessibility:** добавлены `aria-label`, `role="link"`, `tabIndex`, `title` (native tooltip), `aria-current="page"` для активного пункта, `aria-disabled`, keyboard handlers (Enter/Space), focus-visible ring. Аналогично для logo, compact balance widget, support link.
3. **CreditPage:** кнопка «Взять кредит» перенесена внутрь карточки «У вас нет кредитов» (empty state); при наличии активных кредитов — под последним кредитом.
4. **Leaderboard bug fix:** бэкенд `routes/leaderboard.py` переписан — возвращает `{players: [...]}` с полями `username`, `id`, `balance_ton`, `avatar`, `display_name`; поддерживает параметр `sort_by=balance|income|businesses|plots`. Рейтинг теперь отображает всех пользователей.
5. **TransactionHistory mobile:** фильтр теперь `w-full` на мобильных с 16px отступами слева/справа (`px-4` container); на десктопе остаётся компактным (`sm:w-40`).

## Pending / не запрашивалось
- 3rd-party ключи (Telegram bot, TON mainnet wallet, SMTP/Resend, Stripe) — по запросу пользователя НЕ конфигурируются.
- Деплой в prod — не требуется.
- Google OAuth кнопка видна, но не сконфигурирована.

## Backlog
- P1: донастройка внешних интеграций (Telegram / TON mainnet) когда понадобится.
- P2: скрытие Google OAuth кнопки или настройка OAuth client_id.
- P2: замена Tailwind CDN на скомпилированный CSS (warning в консоли).
