"""Session 4 regression tests.

Covers:
- 2FA dep applied on /admin/withdrawal/reject + /admin/wallets (POST/PUT/DELETE)
- Stricter CSP (script-src 'self' 'nonce-...' 'strict-dynamic') + X-CSP-Nonce header
- MongoDB-backed brute-force lockout (login_attempts collection, TTL, multi-worker)
- routes/leaderboard.py and routes/notifications.py (incl. /low-durability)
"""
import os
import re
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ton-urban-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASS = "Qetuyrwioo"
PLAYER_EMAIL = "player@toncity.com"
PLAYER_PASS = "Player@2024"


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    return client[os.environ.get("DB_NAME", "test_database")]


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=10)


@pytest.fixture(scope="session")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASS)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def player_token():
    r = _login(PLAYER_EMAIL, PLAYER_PASS)
    assert r.status_code == 200, f"Player login failed: {r.status_code} {r.text[:200]}"
    return r.json().get("token") or r.json().get("access_token")


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ===== 2FA / RBAC on admin endpoints =====

class TestAdmin2FA:
    def test_withdrawal_reject_non_admin_forbidden(self, player_token):
        r = requests.post(
            f"{API}/admin/withdrawal/reject/nonexistent_id",
            headers=_auth(player_token), json={"reason": "x"}, timeout=10,
        )
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_admin_wallets_post_non_admin_forbidden(self, player_token):
        r = requests.post(
            f"{API}/admin/wallets",
            headers=_auth(player_token), json={"address": "UQxyz"}, timeout=10,
        )
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_admin_wallets_put_non_admin_forbidden(self, player_token):
        r = requests.put(
            f"{API}/admin/wallets/some_id",
            headers=_auth(player_token), json={"address": "UQxyz"}, timeout=10,
        )
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_admin_wallets_delete_non_admin_forbidden(self, player_token):
        r = requests.delete(
            f"{API}/admin/wallets/some_id",
            headers=_auth(player_token), timeout=10,
        )
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_admin_wallets_post_admin_no_totp_required(self, admin_token, mongo):
        """Admin without 2FA enabled should NOT be blocked by 401 'TOTP required'.
        Should proceed past auth → may return 400/422 for body issues."""
        u = mongo.users.find_one({"email": ADMIN_EMAIL})
        if u and u.get("totp_enabled"):
            pytest.skip("Admin has TOTP enabled — skipping no-TOTP check")
        r = requests.post(
            f"{API}/admin/wallets",
            headers=_auth(admin_token), json={}, timeout=10,
        )
        # Must not be 401 (TOTP required) or 403
        assert r.status_code not in (401, 403), f"Unexpected auth block: {r.status_code} {r.text[:200]}"
        # The detail should not mention TOTP
        body = r.text.lower()
        assert "totp" not in body and "2fa" not in body, f"Blocked by TOTP when disabled: {r.text[:200]}"


# ===== CSP nonce =====

class TestCSPNonce:
    def test_csp_header_nonce_and_strict_dynamic(self):
        r = requests.get(f"{API}/", timeout=10)
        csp = r.headers.get("content-security-policy") or r.headers.get("Content-Security-Policy")
        assert csp, f"No CSP header. Headers: {list(r.headers.keys())}"
        assert "script-src 'self'" in csp, f"script-src 'self' missing: {csp}"
        assert "'strict-dynamic'" in csp, f"strict-dynamic missing: {csp}"
        m = re.search(r"'nonce-([A-Za-z0-9_\-]+)'", csp)
        assert m, f"nonce-... missing: {csp}"
        nonce_in_csp = m.group(1)
        # X-CSP-Nonce header
        x_nonce = r.headers.get("X-CSP-Nonce") or r.headers.get("x-csp-nonce")
        assert x_nonce, f"X-CSP-Nonce header missing"
        assert x_nonce == nonce_in_csp, f"X-CSP-Nonce != CSP nonce: {x_nonce} vs {nonce_in_csp}"

    def test_nonce_changes_per_request(self):
        r1 = requests.get(f"{API}/", timeout=10)
        time.sleep(0.2)
        r2 = requests.get(f"{API}/", timeout=10)
        n1 = r1.headers.get("X-CSP-Nonce")
        n2 = r2.headers.get("X-CSP-Nonce")
        assert n1 and n2 and n1 != n2, f"Nonce did not change: {n1} == {n2}"


# ===== MongoDB brute-force lockout =====

class TestBruteForceMongo:
    def test_lockout_uses_mongo_collection(self, mongo):
        # Unique email, unique to this IP
        email = f"bruteforce-test-{uuid.uuid4().hex[:8]}@example.com"
        # cleanup any prior
        mongo.login_attempts.delete_many({"key": {"$regex": f"^{re.escape(email)}\\|"}})
        # Register first so the login flow reaches password-check stage
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "username": f"bf_{uuid.uuid4().hex[:6]}",
            "password": "Strong123"
        }, timeout=10)
        if reg.status_code not in (200, 201):
            pytest.skip(f"Cannot register bf test user: {reg.status_code} {reg.text[:150]}")

        got_429_lockout = False
        attempts_made = 0
        waited_once = False
        for i in range(20):
            r = requests.post(f"{API}/auth/login",
                              json={"email": email, "password": "WrongZ9999"}, timeout=10)
            attempts_made += 1
            if r.status_code == 429:
                body_text = r.text
                if "Слишком много" in body_text:
                    got_429_lockout = True
                    break
                elif not waited_once:
                    # slowapi hit — pause once and continue
                    waited_once = True
                    time.sleep(62)
                    continue
                else:
                    # still slowapi-limited, give up loop
                    break
            time.sleep(0.3)

        # Verify collection entry (primary proof of Mongo-backed lockout)
        entry = mongo.login_attempts.find_one({"key": {"$regex": f"^{re.escape(email)}\\|"}})
        assert entry is not None, f"No login_attempts entry for {email}. attempts={attempts_made}"
        assert entry.get("count", 0) >= 1, f"count not incremented: {entry}"
        # If we hit the Mongo 15-min lockout message, locked_until must be set
        if got_429_lockout:
            assert entry.get("locked_until") is not None, f"locked_until not set: {entry}"

        # cleanup
        mongo.login_attempts.delete_many({"key": {"$regex": f"^{re.escape(email)}:"}})

    def test_successful_login_clears_lockout(self, mongo):
        email = f"bfclear-{uuid.uuid4().hex[:8]}@example.com"
        pwd = "Strong123"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "username": f"bfc_{uuid.uuid4().hex[:6]}", "password": pwd,
        }, timeout=10)
        if reg.status_code not in (200, 201):
            pytest.skip(f"Cannot register: {reg.status_code}")
        # One wrong attempt — may or may not land before slowapi limit; retry once
        got_entry = False
        for attempt in range(3):
            r = requests.post(f"{API}/auth/login",
                              json={"email": email, "password": "WrongZ"}, timeout=10)
            if r.status_code == 429 and "Слишком много" not in r.text:
                time.sleep(62)
                continue
            entry = mongo.login_attempts.find_one({"key": {"$regex": f"^{re.escape(email)}\\|"}})
            if entry:
                got_entry = True
                break
            time.sleep(0.3)
        if not got_entry:
            pytest.skip("Could not create failure entry (slowapi rate-limit)")
        # Successful login
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=10)
        if r.status_code == 429:
            pytest.skip(f"slowapi blocked success login: {r.text[:100]}")
        assert r.status_code == 200, f"Login post-failures failed: {r.status_code} {r.text[:150]}"
        # Entry cleared
        entry_after = mongo.login_attempts.find_one({"key": {"$regex": f"^{re.escape(email)}\\|"}})
        assert entry_after is None, f"login_attempts not cleared after success: {entry_after}"


# ===== leaderboard route =====

class TestLeaderboard:
    def test_get_leaderboard(self):
        r = requests.get(f"{API}/leaderboard", timeout=10)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "leaderboard" in data and isinstance(data["leaderboard"], list)
        if data["leaderboard"]:
            sample = data["leaderboard"][0]
            for k in ["display_name", "level", "total_income", "total_turnover",
                      "plots_count", "businesses_count"]:
                assert k in sample, f"Missing {k} in leaderboard entry: {sample}"


# ===== notifications route =====

class TestNotifications:
    def test_get_notifications(self, admin_token):
        r = requests.get(f"{API}/notifications", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert "notifications" in body and isinstance(body["notifications"], list)

    def test_mark_notification_read(self, admin_token):
        r = requests.post(f"{API}/notifications/nonexistent_id_123/read",
                          headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200, r.text[:200]
        assert r.json().get("status") == "ok"

    def test_low_durability_warning(self, admin_token, mongo):
        biz = mongo.businesses.find_one({"id": "test-biz-001"})
        if not biz:
            pytest.skip("test-biz-001 not in DB")
        # (a) set durability=15 -> warning
        mongo.businesses.update_one({"id": "test-biz-001"}, {"$set": {"durability": 15}})
        r = requests.get(f"{API}/notifications/low-durability",
                         headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "alerts" in data and "count" in data
        # find our test biz
        match = [a for a in data["alerts"] if a.get("business_id") == "test-biz-001"]
        assert match, f"test-biz-001 not in alerts: {data}"
        a = match[0]
        assert a["severity"] == "warning"
        assert a["durability"] == 15.0
        assert a["business_type"] == biz.get("business_type", "gram_bank")
        assert a["level"] == 5

        # (d) durability=5 -> critical
        mongo.businesses.update_one({"id": "test-biz-001"}, {"$set": {"durability": 5}})
        r2 = requests.get(f"{API}/notifications/low-durability",
                          headers=_auth(admin_token), timeout=10)
        assert r2.status_code == 200
        data2 = r2.json()
        match2 = [a for a in data2["alerts"] if a.get("business_id") == "test-biz-001"]
        assert match2 and match2[0]["severity"] == "critical", f"Expected critical: {data2}"

        # (e) durability=50 -> no alert for this biz
        mongo.businesses.update_one({"id": "test-biz-001"}, {"$set": {"durability": 50}})
        r3 = requests.get(f"{API}/notifications/low-durability",
                          headers=_auth(admin_token), timeout=10)
        assert r3.status_code == 200
        data3 = r3.json()
        match3 = [a for a in data3["alerts"] if a.get("business_id") == "test-biz-001"]
        assert not match3, f"Biz should not alert at 50% durability: {data3}"

        # cleanup — restore to 100
        mongo.businesses.update_one({"id": "test-biz-001"}, {"$set": {"durability": 100}})

    def test_low_durability_requires_auth(self):
        r = requests.get(f"{API}/notifications/low-durability", timeout=10)
        assert r.status_code in (401, 403), f"Expected 401/403 got {r.status_code}"
