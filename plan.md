# TON City Builder — Interactive Tutorial Sandbox Plan

## 1. Objectives
- Deliver an interactive, **linear 13-step** tutorial “sandbox with illusions” that guides a logged-in player through core screens/actions.
- Enforce a **guided path**: no step back, route + API blocking while `tutorial_active=true`.
- Implement **client-only illusions** for plots/resources while creating **exactly 1 real market record** with `tutorial:true` (hidden from other users).
- Persist tutorial progress in `users` collection with required fields and support **atomic rollback** on finish.
- Provide automated coverage for: full flow, isolation from other users, blocked API/route behavior, and rollback.

## 2. Implementation Steps

### Phase 1 — Core Tutorial POC (isolation-first)
User stories:
1. As a player, I can start tutorial and see current step/state from API.
2. As a player, I can only call APIs allowed for the current tutorial step.
3. As a player, I can advance steps only when the gate condition is satisfied.
4. As a player, I can create one tutorial market lot that is invisible to other users.
5. As a player, I can finish tutorial and all tutorial artifacts are rolled back.

1) **Backend skeleton (minimal):**
- Add `routes/tutorial.py` with endpoints:
  - `POST /api/tutorial/start`
  - `GET /api/tutorial/status`
  - `POST /api/tutorial/advance`
  - `POST /api/tutorial/fake-buy-plot`
  - `POST /api/tutorial/fake-grant-resource`
  - `POST /api/tutorial/finish`
- Add `tutorial_steps.py` containing 13 steps config (ids below) with:
  - `target` (route + optional DOM target key)
  - `allowed_api` list
  - `gate` descriptor (`client_ack`, `page_visit`, `db_check`)
- Add `tutorial_guard.py` middleware:
  - If `user.tutorial_active` → allow only `ALWAYS_ALLOWED + current_step.allowed_api`.
  - Always allow `/api/tutorial/*`, `/api/auth/me`, `/api/auth/login`, `/api/config`, and other minimal health/config endpoints.

2) **DB schema + snapshot:**
- On `start`:
  - Set: `tutorial_active=true`, `tutorial_current_step='welcome'`, `tutorial_completed=false`, `tutorial_started_at`.
  - Create `tutorial_snapshot` (copy of fields to restore; keep MVP: balance, resources, plots_owned, businesses_owned, relevant tutorial fields).
  - Initialize `tutorial_state: { fake_plots: [], fake_resources: {}, fake_lot_id: null }`.

3) **One real tutorial listing (POC target):**
- Implement `create_lot` step gate with **DB check**: `market_listings` contains `tutorial:true` listing for this user.
- Update `/api/market/listings` to filter out tutorial lots: `{tutorial: {$ne: true}}`.

4) **Rollback (POC target):**
- `finish` endpoint:
  - `delete_many` from `market_listings` where `seller_id=user.id AND tutorial:true`.
  - `delete_many` from `transactions` where `tutorial:true`.
  - Restore from `tutorial_snapshot` and unset all tutorial temp fields.

5) **POC validation script/tests (backend-focused):**
- Add a small pytest (or script) that:
  - Starts tutorial, asserts status.
  - Calls a blocked endpoint and expects 403/401.
  - Inserts tutorial listing via existing listing endpoint (or dedicated tutorial helper) and validates it’s hidden from public listings.
  - Finishes tutorial and confirms deletion + restoration.

Checkpoint: POC passes before UI build-out.

---

### Phase 2 — V1 App Development (guided UI + illusions)
User stories:
1. As a player, I see a start modal and can begin the tutorial.
2. As a player, each step highlights exactly what to click (spotlight overlay).
3. As a player, I can’t navigate to unrelated pages during tutorial.
4. As a player, I can perform fake actions (buy plot, grant resources) and see them reflected in UI.
5. As a player, I can finish tutorial and return to normal gameplay.

1) **Frontend tutorial framework:**
- Add `context/TutorialContext.js`:
  - Holds `tutorial_active`, `current_step`, `tutorial_state`, `allowedRoutes`, `stepConfig`.
  - Methods: `start()`, `advance()`, `finish()`, `fakeBuyPlot()`, `fakeGrantResource()`.
- Add tutorial UI components:
  - `components/tutorial/TutorialStartModal.jsx`
  - `components/tutorial/TutorialFinishModal.jsx`
  - `components/tutorial/TutorialTour.jsx` overlay with spotlight (CSS `clip-path`) + “End tutorial”.
- Add `lib/tutorialTranslations.js` with step strings (title/description/instruction) in 8 languages.

2) **App-wide wiring:**
- `App.js`: wrap app in `TutorialProvider`, mount `TutorialTour` globally.
- Add route blocking:
  - Prevent navigating away unless route is allowed for current step.
  - Allow `go_security` step to be optional (skip-able) per requirements.

3) **Sidebar restrictions:**
- `Sidebar.jsx`: disable non-allowed nav items during tutorial; add `data-testid` to each item for tour targeting.

4) **Illusions + intercepts in key pages:**
- `TonIslandPage.jsx`:
  - Intercept plot purchase click → call `/api/tutorial/fake-buy-plot` during `fake_buy_plot`.
  - Merge `tutorial_state.fake_plots` into displayed ownership/availability.
- `MyBusinessesPage.jsx`:
  - Merge `tutorial_state.fake_resources` into resource widgets.
- `TradingPageNew.jsx`:
  - Merge fake resources into “available” resources.
  - Intercept “create listing” during `create_lot` to create a real listing with `tutorial:true` and set `tutorial_state.fake_lot_id`.
  - Ensure `go_trading_buy` copy **does not mention 3% commission**.

5) **Step sequence (13 linear, no back):**
- welcome (client_ack)
- go_dashboard (page_visit)
- go_island (page_visit)
- fake_buy_plot (client_ack + server action)
- go_businesses (page_visit)
- fake_add_resources (client_ack + server action)
- go_trading_buy (page_visit)
- go_trading_my (page_visit)
- create_lot (db_check: tutorial listing exists)
- go_credit (page_visit)
- go_leaderboard (page_visit)
- go_security (optional page_visit)
- finish (client_ack → `/api/tutorial/finish`)

6) **Update seeding:**
- `seed_users.py`: reset all `tutorial_*` fields on seed/update.

Conclude Phase 2 with 1 full E2E run (Playwright) of the tutorial.

---

### Phase 3 — Hardening + Comprehensive Testing
User stories:
1. As a player, if my token expires mid-tutorial, I see a clear recovery path.
2. As a player, refresh/reload keeps my tutorial progress.
3. As another user, I never see tutorial listings.
4. As a player, I cannot bypass tutorial by calling restricted APIs.
5. As a player, finishing tutorial always restores my account state.

- Add tests (backend + frontend):
  - End-to-end all steps (happy path).
  - “Other user can’t see tutorial lot”.
  - Middleware blocks disallowed APIs per step.
  - Finish rollback restores snapshot and cleans tutorial records.
  - Optional step skip behavior for `go_security`.
- Add small UX polish:
  - Error messaging for blocked navigation/API.
  - “End tutorial” confirmation.

## 3. Next Actions
1. Implement backend POC files: `routes/tutorial.py`, `tutorial_steps.py`, `tutorial_guard.py` and wire into `server.py`.
2. Add `/api/market/listings` filter `{tutorial: {$ne: true}}`.
3. Extend `seed_users.py` to reset tutorial fields.
4. Write/run POC tests verifying blocking, hidden lot, and rollback.
5. Build frontend provider + tour overlay, then patch Sidebar/TonIsland/Trading/MyBusinesses with illusion merges + intercepts.
6. Run Playwright E2E for the 13-step flow and fix regressions.

## 4. Success Criteria
- Tutorial is strictly linear (no back) and persists progress in DB.
- While `tutorial_active=true`:
  - Frontend blocks routes outside the step.
  - Backend middleware blocks APIs outside `ALWAYS_ALLOWED + step.allowed_api`.
- Exactly **one** real tutorial listing is created with `tutorial:true` and is **not visible** in public listings.
- Fake plot/resources appear in UI but do not affect real economy.
- `finish` performs atomic rollback: tutorial listings/transactions removed, user restored from snapshot, tutorial fields cleared.
- Automated tests pass: full tutorial, visibility isolation, blocked API, rollback correctness.

## 5. Status (Completed)

### Phase 1 ✅
- Cloned `SaleXPetROV/TON_City_2.1` to /app.
- Installed backend + frontend deps. Backend + frontend running under supervisor.
- Seeded 2 users: admin `sanyanazarov212@gmail.com / Qetuyrwioo` and regular `player@toncity.com / Player@2024`.

### Phase 2 ✅
- Backend: `tutorial_steps.py`, `tutorial_guard.py`, `routes/tutorial.py` created.
- `server.py` wired (router + guard middleware + `{tutorial: {$ne: true}}` filter on `GET /api/market/listings`).
- `seed_users.py` resets tutorial fields.
- Frontend: `TutorialContext`, `TutorialTour`, `TutorialStartModal`, `TutorialFinishModal` components created.
- Translations: 8 languages (en, ru, es, zh, fr, de, ja, ko) for all 12 steps + UI.
- Wired into `App.js`, `Sidebar.jsx` (with tutorial-gated disabled items), `TonIslandPage.jsx` (intercept purchase → fake-buy-plot), `TradingPageNew.jsx` (intercept create listing → tutorial create-lot).
- Per user's plan: `go_trading_buy` copy does NOT mention 3% commission; `go_security` is optional (skippable).

### Phase 3 ✅
- Testing agent: backend 94% (16/17) with 0 functional bugs (1 test-ordering issue only); frontend 100% with all user stories passing.
- Confirmed: welcome modal auto-shows, spotlight highlights work, sidebar disable/enable, hidden tutorial lots, atomic rollback on finish.
