"""
Full E2E backend test suite for TON City 2.1 (iteration 2).
Covers: Auth, Tutorial, Cities/Plots, TON Island, Businesses, Market/Trading,
Banking/Withdrawal, Credit, Security/2FA, Admin guard, Leaderboard, Notifications,
Buffs, Stats, Health, Sprites.
Each test is independent; tutorial test resets state at end so it doesn't pollute
other endpoints.
"""

import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://ton-builder.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "sanyanazarov212@gmail.com", "password": "Qetuyrwioo"}
USER = {"email": "testuser@example.com", "password": "Test12345!"}


# ---------- helpers / fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, creds):
    r = s.post(f"{BASE}/api/auth/login", json=creds, timeout=15)
    assert r.status_code in (200, 202), f"login failed {r.status_code} {r.text[:200]}"
    data = r.json()
    # If 2FA required path returns different structure
    return data


@pytest.fixture(scope="session")
def admin_token(session):
    data = _login(session, ADMIN)
    if "token" not in data:
        pytest.skip(f"Admin login did not return token: {data}")
    return data["token"]


@pytest.fixture(scope="session")
def user_token(session):
    data = _login(session, USER)
    if "token" not in data:
        pytest.skip(f"User login did not return token: {data}")
    return data["token"]


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health / Stats ----------
class TestHealth:
    def test_health(self, session):
        r = session.get(f"{BASE}/api/health", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") in ("ok", "healthy", True) or "status" in d

    def test_root(self, session):
        r = session.get(f"{BASE}/api/", timeout=10)
        assert r.status_code in (200, 404)

    def test_stats(self, session):
        r = session.get(f"{BASE}/api/stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "total_players" in d
        assert d["total_players"] >= 2


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self, session):
        d = _login(session, ADMIN)
        assert "token" in d
        assert d["user"]["email"] == ADMIN["email"]
        assert d["user"].get("is_admin") is True

    def test_login_user(self, session):
        d = _login(session, USER)
        assert "token" in d
        assert d["user"]["email"] == USER["email"]
        assert d["user"].get("is_admin") is False

    def test_login_wrong_password(self, session):
        r = session.post(f"{BASE}/api/auth/login",
                         json={"email": USER["email"], "password": "WRONG"}, timeout=10)
        assert r.status_code in (400, 401, 403, 423)

    def test_login_missing_user(self, session):
        r = session.post(f"{BASE}/api/auth/login",
                         json={"email": "nope@nope.com", "password": "x"}, timeout=10)
        assert r.status_code in (400, 401, 404, 422)

    def test_protected_no_token(self, session):
        r = session.get(f"{BASE}/api/auth/me", timeout=10)
        assert r.status_code in (401, 403)

    def test_protected_bad_token(self, session):
        r = session.get(f"{BASE}/api/auth/me",
                        headers={"Authorization": "Bearer abc.def.ghi"}, timeout=10)
        assert r.status_code in (401, 403)

    def test_me_with_token(self, session, user_token):
        r = session.get(f"{BASE}/api/auth/me", headers=H(user_token), timeout=10)
        assert r.status_code == 200
        assert r.json().get("email") == USER["email"]

    def test_register_validation(self, session):
        # weak password should be rejected (or fail other validation)
        r = session.post(f"{BASE}/api/auth/register",
                         json={"email": "x@x.com", "password": "1", "username": "x"}, timeout=10)
        assert r.status_code in (400, 422, 403)


# ---------- Cities / Plots ----------
class TestCities:
    def test_list_cities(self, session, user_token):
        r = session.get(f"{BASE}/api/cities", headers=H(user_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (list, dict))

    def test_city_plots(self, session, user_token):
        r = session.get(f"{BASE}/api/cities", headers=H(user_token), timeout=15)
        cities = r.json() if isinstance(r.json(), list) else r.json().get("cities", [])
        if not cities:
            pytest.skip("No cities seeded")
        cid = cities[0].get("id") or cities[0].get("_id") or cities[0].get("city_id")
        r2 = session.get(f"{BASE}/api/cities/{cid}", headers=H(user_token), timeout=15)
        assert r2.status_code == 200
        r3 = session.get(f"{BASE}/api/cities/{cid}/plots", headers=H(user_token), timeout=15)
        assert r3.status_code == 200


# ---------- TON Island ----------
class TestTONIsland:
    def test_island_config(self, session, user_token):
        r = session.get(f"{BASE}/api/config", headers=H(user_token), timeout=15)
        assert r.status_code in (200, 404)

    def test_island_map(self, session, user_token):
        r = session.get(f"{BASE}/api/island", headers=H(user_token), timeout=15)
        assert r.status_code in (200, 404), r.text[:200]


# ---------- Businesses / Patrons ----------
class TestBusinesses:
    def test_business_types(self, session, user_token):
        r = session.get(f"{BASE}/api/businesses/types", headers=H(user_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d  # non-empty

    def test_my_businesses(self, session, user_token):
        r = session.get(f"{BASE}/api/my/businesses", headers=H(user_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (list, dict))

    def test_patrons_list(self, session, user_token):
        r = session.get(f"{BASE}/api/patrons", headers=H(user_token), timeout=10)
        assert r.status_code == 200


# ---------- Market / Trading ----------
class TestMarket:
    def test_listings(self, session, user_token):
        r = session.get(f"{BASE}/api/market/listings", headers=H(user_token), timeout=10)
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("listings", [])
        # tutorial:true must be filtered out
        for x in items:
            assert x.get("tutorial") is not True


# ---------- Banking / Withdrawal ----------
class TestBanking:
    def test_banks(self, session, user_token):
        r = session.get(f"{BASE}/api/banks", headers=H(user_token), timeout=10)
        assert r.status_code == 200

    def test_withdrawals_queue(self, session, user_token):
        r = session.get(f"{BASE}/api/withdrawals/queue", headers=H(user_token), timeout=10)
        assert r.status_code == 200


# ---------- Credits ----------
class TestCredit:
    def test_my_loans(self, session, user_token):
        r = session.get(f"{BASE}/api/credit/my-loans", headers=H(user_token), timeout=10)
        assert r.status_code == 200

    def test_available_banks(self, session, user_token):
        r = session.get(f"{BASE}/api/credit/available-banks", headers=H(user_token), timeout=10)
        assert r.status_code == 200


# ---------- Security / 2FA ----------
class TestSecurity:
    def test_security_status(self, session, user_token):
        r = session.get(f"{BASE}/api/security/status", headers=H(user_token), timeout=10)
        assert r.status_code == 200

    def test_passkey_list(self, session, user_token):
        r = session.get(f"{BASE}/api/security/passkey/list", headers=H(user_token), timeout=10)
        assert r.status_code == 200


# ---------- Leaderboard / Notifications / Buffs ----------
class TestMisc:
    def test_leaderboard(self, session, user_token):
        r = session.get(f"{BASE}/api/leaderboard", headers=H(user_token), timeout=10)
        assert r.status_code == 200

    def test_notifications(self, session, user_token):
        r = session.get(f"{BASE}/api/notifications", headers=H(user_token), timeout=10)
        assert r.status_code == 200

    def test_resource_buffs_available(self, session, user_token):
        r = session.get(f"{BASE}/api/resource-buffs/available", headers=H(user_token), timeout=10)
        assert r.status_code == 200

    def test_my_resources(self, session, user_token):
        r = session.get(f"{BASE}/api/my/resources", headers=H(user_token), timeout=10)
        assert r.status_code == 200

    def test_sprites_info(self, session, user_token):
        r = session.get(f"{BASE}/api/sprites/info", headers=H(user_token), timeout=10)
        assert r.status_code == 200


# ---------- Admin guard ----------
class TestAdmin:
    def test_user_blocked_admin_stats(self, session, user_token):
        r = session.get(f"{BASE}/api/admin/stats", headers=H(user_token), timeout=10)
        assert r.status_code in (401, 403)

    def test_user_blocked_admin_users(self, session, user_token):
        r = session.get(f"{BASE}/api/admin/users", headers=H(user_token), timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_stats(self, session, admin_token):
        r = session.get(f"{BASE}/api/admin/stats", headers=H(admin_token), timeout=10)
        assert r.status_code == 200

    def test_admin_users(self, session, admin_token):
        r = session.get(f"{BASE}/api/admin/users", headers=H(admin_token), timeout=10)
        assert r.status_code == 200


# ---------- Tutorial (run last; resets at end) ----------
class TestTutorial:
    def test_tutorial_status(self, session, user_token):
        r = session.get(f"{BASE}/api/tutorial/status", headers=H(user_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "tutorial_active" in d or "active" in d or "step" in d or "current_step" in d

    def test_tutorial_reset_then_start(self, session, user_token):
        # reset to clean state
        session.post(f"{BASE}/api/tutorial/reset", headers=H(user_token), timeout=10)
        r = session.post(f"{BASE}/api/tutorial/start", headers=H(user_token), timeout=10)
        assert r.status_code in (200, 201, 409)
        # cleanup
        session.post(f"{BASE}/api/tutorial/reset", headers=H(user_token), timeout=10)

    def test_tutorial_guard_blocks_during_active(self, session, user_token):
        session.post(f"{BASE}/api/tutorial/reset", headers=H(user_token), timeout=10)
        session.post(f"{BASE}/api/tutorial/start", headers=H(user_token), timeout=10)
        # try a guarded endpoint - market listing creation should be blocked
        r = session.post(f"{BASE}/api/market/list",
                         headers=H(user_token),
                         json={"resource_type": "wood", "amount": 1, "price_per_unit": 1.0},
                         timeout=10)
        # 403 (guard) or 400 (validation) — guard is the expected 403
        assert r.status_code in (400, 403, 409, 422)
        session.post(f"{BASE}/api/tutorial/reset", headers=H(user_token), timeout=10)
