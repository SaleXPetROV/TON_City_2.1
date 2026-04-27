# TON City 2.1 — Full E2E Test Report (Iteration 2)

**Date:** 2026-01-27  
**Backend:** 37/37 pytest cases ✅ (100%)  
**Frontend:** Smoke + multi-route + responsive ✅ with caveats  
**Test file:** `/app/backend/tests/test_full_suite.py` · `/app/test_reports/pytest/full_suite.xml`

## Backend Summary

| Module | Endpoint / Feature | Status | Notes |
|--------|---------------------|--------|-------|
| Health | `GET /api/health` | PASS | 200 |
| Health | `GET /api/` | PASS | 200/404 acceptable |
| Stats | `GET /api/stats` | PASS | total_players=2, total_volume_ton=1330.0 |
| Auth | `POST /api/auth/login` (admin) | PASS | JWT issued, is_admin=true |
| Auth | `POST /api/auth/login` (user) | PASS | JWT issued, is_admin=false |
| Auth | `POST /api/auth/login` wrong password | PASS | 401 |
| Auth | `POST /api/auth/login` missing user | PASS | 401 |
| Auth | `GET /api/auth/me` no token | PASS | 401/403 |
| Auth | `GET /api/auth/me` bad token | PASS | 401/403 |
| Auth | `GET /api/auth/me` valid token | PASS | returns user payload |
| Auth | `POST /api/auth/register` weak pw | PASS | 422 |
| Cities | `GET /api/cities` | PASS | Demo cities seeded |
| Cities | `GET /api/cities/{id}` | PASS | Single city |
| Cities | `GET /api/cities/{id}/plots` | PASS | Plot grid returned |
| TON Island | `GET /api/config` | PASS | |
| TON Island | `GET /api/island` | PASS | Map data |
| Businesses | `GET /api/businesses/types` | PASS | Type catalog |
| Businesses | `GET /api/my/businesses` | PASS | User business list |
| Patrons | `GET /api/patrons` | PASS | Tier3 patrons |
| Market | `GET /api/market/listings` | PASS | tutorial:true filtered |
| Banking | `GET /api/banks` | PASS | |
| Withdrawals | `GET /api/withdrawals/queue` | PASS | |
| Credit | `GET /api/credit/my-loans` | PASS | |
| Credit | `GET /api/credit/available-banks` | PASS | |
| Security | `GET /api/security/status` | PASS | |
| Security | `GET /api/security/passkey/list` | PASS | |
| Leaderboard | `GET /api/leaderboard` | PASS | |
| Notifications | `GET /api/notifications` | PASS | |
| Buffs | `GET /api/resource-buffs/available` | PASS | |
| Resources | `GET /api/my/resources` | PASS | |
| Sprites | `GET /api/sprites/info` | PASS | (note: spec asked /api/sprites/{type} which is not the actual endpoint) |
| Admin guard | `GET /api/admin/stats` as user | PASS | 403 |
| Admin guard | `GET /api/admin/users` as user | PASS | 403 |
| Admin | `GET /api/admin/stats` as admin | PASS | 200 |
| Admin | `GET /api/admin/users` as admin | PASS | 200 |
| Tutorial | `GET /api/tutorial/status` | PASS | |
| Tutorial | `POST /api/tutorial/reset` + `start` | PASS | |
| Tutorial guard | `POST /api/market/list` while active | PASS | 403 (blocked) |

### Endpoints NOT covered by automated test (left for next iteration)
Wallet auth `/api/auth/verify-wallet` (requires real TON signature), instant withdraw end-to-end (requires 2FA + TON keys), passkey register/auth (WebAuthn needs browser), all 13 tutorial steps individually, business build → upgrade → demolish full lifecycle, market buy/cancel real flow, credit apply→repay, alliance/contract complex flows, chat WebSocket, APScheduler job introspection, admin grant-balance/set-admin (would mutate state).

## Frontend Summary

| Area | Test | Status | Notes |
|------|------|--------|-------|
| Landing | Hero + 4 feature cards render | PASS | "BUILD YOUR DIGITAL CITY" hero, BUILD/EARN/TRADE/GROW |
| Landing | Stats: 2 PLAYERS, 0 PLOTS, 1 BUSINESS | PASS | (TON IN CIRCULATION mismatch — see issues) |
| Landing | Login / Register / Start / Tutorial buttons | PASS | All visible |
| Landing | Language switcher visible | PASS | "EN" with flag |
| Login | Modal opens, email+password, Sign In | PASS | testuser logs in successfully, "Logged in!" toast |
| Login | JWT stored in localStorage | PASS | token key found |
| Auth | `/api/auth/me` from FE returns 200 | PASS | |
| Tutorial | Welcome modal "13 steps" appears | PASS | Skip button works |
| Routing | `/island` | PASS | TON ISLAND page renders |
| Routing | `/leaderboard` | PASS | Empty leaderboard message |
| Routing | `/security` | PASS | "Account not protected" |
| Routing | `/credit` | PASS | Credits page renders |
| Routing | `/dashboard` | **FAIL** | Renders landing page (route not registered) |
| Routing | `/cities` | **FAIL** | Empty body |
| Routing | `/businesses` | **FAIL** | Empty body |
| Routing | `/market` | **FAIL** | Empty body |
| Routing | `/notifications` | **FAIL** | Empty body |
| Mobile | Viewport 390×844 | PASS | Hamburger ☰ icon present |
| i18n | EN selected | **PARTIAL** | Some widgets show RU strings (Калькулятор, P2P Торговля, Мои бизнесы, Рейтинг) |
| Logout | Visible logout control | **NOT FOUND** | Could not locate Logout in user menu |
| Console | JS errors during smoke | PASS | 0 errors (only Tailwind CDN warning) |

## Issues — Priorities

### MEDIUM
1. SPA routes `/dashboard`, `/cities`, `/businesses`, `/market`, `/notifications` render empty body — verify `<Route>` declarations in `App.js` and ensure components mount when accessed via direct URL (not just sidebar click).
2. Dashboard widgets contain hard-coded Russian labels visible while UI is set to English — finish i18n keys.
3. TON-in-circulation stat: backend `/api/stats` returns 1330.0 but FE displays 150.0 when authenticated. Reconcile data source.

### LOW
4. TON Island shows balance in `$CITY` not TON — currency unit confusing.
5. No discoverable Logout control via standard selectors — add `data-testid="logout-button"`.
6. Tailwind via CDN in production (console warning) — switch to compiled build.
7. Google OAuth button shown but provider not configured — runtime failure if clicked.

## Code Review Comments
- `/app/backend/server.py` ~9,500 lines — strongly recommend continuing the modularization that has begun in `/app/backend/routes/*`. Half of the routes still live in server.py.
- Spec/implementation drift on a few endpoint names (e.g., `/api/auth/logout` not present, `/api/sprites/{type}` not present) — document the actual contract in `ARCHITECTURE.md`.
- `/api/stats` is unauthenticated and exposes treasury data — confirm intentional.
- Add `data-testid` attributes to sidebar nav, login form, dashboard widgets, and logout button to support reliable Playwright automation in future runs.

## Credentials Used
From `/app/memory/test_credentials.md`:
- Admin: `sanyanazarov212@gmail.com` / `Qetuyrwioo`
- Player: `testuser@example.com` / `Test12345!`

## Files Modified
- Created `/app/backend/tests/test_full_suite.py`
- Created `/app/test_reports/pytest/full_suite.xml`
- Created `/app/test_reports/iteration_2.json`
- Created `/app/test_reports/full_report.md`
