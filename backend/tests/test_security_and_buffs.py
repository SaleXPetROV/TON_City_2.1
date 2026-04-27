"""
Backend tests for: JWT auth, rate-limiting, brute-force lockout, password strength,
admin 403 Forbidden, security headers, repair endpoint JSON safety,
resource-buffs endpoints.
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ton-builder.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASS = "Qetuyrwioo"
PLAYER_EMAIL = "player@toncity.com"
PLAYER_PASS = "Player@2024"

# ------------- Fixtures -------------

@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    return client[os.environ.get("DB_NAME", "test_database")]

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=10)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in response: {data}"
    return tok

@pytest.fixture(scope="session")
def player_token():
    r = requests.post(f"{API}/auth/login", json={"email": PLAYER_EMAIL, "password": PLAYER_PASS}, timeout=10)
    assert r.status_code == 200, f"Player login failed: {r.status_code} {r.text}"
    data = r.json()
    return data.get("token") or data.get("access_token")


def auth_header(tok):
    return {"Authorization": f"Bearer {tok}"}

# ------------- Auth: login success -------------

class TestLogin:
    def test_login_admin_success(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WrongPassXYZ"}, timeout=10)
        assert r.status_code in (401, 429), f"Expected 401/429 got {r.status_code}: {r.text}"

# ------------- Brute-force lockout -------------

class TestBruteForce:
    def test_brute_force_lockout_after_10(self, mongo):
        # Use unique email so we don't lock out real admin
        test_email = f"bf_test_{uuid.uuid4().hex[:8]}@example.com"
        # Register first
        reg = requests.post(f"{API}/auth/register", json={
            "email": test_email, "username": f"bf_{uuid.uuid4().hex[:6]}",
            "password": "Strong123"
        }, timeout=10)
        if reg.status_code not in (200, 201):
            pytest.skip(f"Cannot register brute-force test user: {reg.status_code} {reg.text[:200]}")

        got_429 = False
        last_status = None
        for i in range(14):
            r = requests.post(f"{API}/auth/login", json={"email": test_email, "password": "WrongXYZ123"}, timeout=10)
            last_status = r.status_code
            if r.status_code == 429:
                got_429 = True
                print(f"Got 429 at attempt {i+1}: {r.text[:200]}")
                break
            time.sleep(0.15)
        assert got_429, f"Expected 429 lockout within 14 attempts, last status={last_status}"

# ------------- Password strength -------------

class TestPasswordStrength:
    def _register(self, pwd):
        uniq = uuid.uuid4().hex[:8]
        return requests.post(f"{API}/auth/register", json={
            "email": f"pwtest_{uniq}@example.com",
            "username": f"pwtest_{uniq}",
            "password": pwd
        }, timeout=10)

    def test_short_password(self):
        r = self._register("12")
        assert r.status_code == 400
        assert "8 символов" in r.text or "8 characters" in r.text.lower(), r.text

    def test_no_digit(self):
        r = self._register("abcdefgh")
        assert r.status_code == 400
        assert "цифру" in r.text or "digit" in r.text.lower(), r.text

    def test_no_letter(self):
        r = self._register("12345678")
        assert r.status_code == 400
        assert "букву" in r.text or "letter" in r.text.lower(), r.text

    def test_strong_password_succeeds(self):
        r = self._register("Strong123")
        assert r.status_code in (200, 201), f"Strong123 rejected: {r.status_code} {r.text[:200]}"

# ------------- Admin 403 Forbidden (no leak) -------------

class TestAdminForbidden:
    def test_non_admin_gets_plain_forbidden(self, player_token):
        r = requests.get(f"{API}/admin/users", headers=auth_header(player_token), timeout=10)
        assert r.status_code == 403
        body = r.json()
        detail = body.get("detail", "")
        assert detail == "Forbidden", f"Expected exactly 'Forbidden' got: {detail!r}"
        # No Russian leak
        assert "админ" not in detail.lower() and "доступ" not in detail.lower()

# ------------- Security headers -------------

class TestSecurityHeaders:
    def test_security_headers_present(self):
        r = requests.get(f"{API}/", timeout=10)
        h = {k.lower(): v for k, v in r.headers.items()}
        missing = []
        for hdr in ["strict-transport-security", "x-frame-options",
                    "x-content-type-options", "referrer-policy",
                    "content-security-policy"]:
            if hdr not in h:
                missing.append(hdr)
        assert not missing, f"Missing security headers: {missing}. Got: {list(h.keys())}"
        assert h["x-frame-options"].upper() == "DENY"
        assert h["x-content-type-options"].lower() == "nosniff"

# ------------- Repair endpoint -------------

class TestRepair:
    def test_repair_nonexistent_returns_json_404(self, admin_token):
        r = requests.post(f"{API}/business/NON_EXISTENT_XYZ_123/repair",
                          headers=auth_header(admin_token), timeout=10)
        assert r.status_code == 404, f"Expected 404 got {r.status_code}"
        # Must be parseable as JSON
        try:
            body = r.json()
        except Exception as e:
            pytest.fail(f"Response not JSON: {e}; body={r.text[:200]}")
        assert "detail" in body or "error" in body or "message" in body

    def test_repair_test_biz_success(self, admin_token, mongo):
        biz = mongo.businesses.find_one({"id": "test-biz-001"})
        if not biz:
            pytest.skip("test-biz-001 not in DB")
        # Reset durability to 60 so there's room to repair
        mongo.businesses.update_one({"id": "test-biz-001"}, {"$set": {"durability": 60}})
        r = requests.post(f"{API}/business/test-biz-001/repair",
                          headers=auth_header(admin_token), timeout=15)
        assert r.status_code == 200, f"Repair failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        print(f"Repair response: {body}")
        # Status field
        assert body.get("status") in ("repaired", "ok", "success") or "cost" in body or "durability" in body, body
        # cost fields should exist
        cost_keys = [k for k in body.keys() if "cost" in k.lower()]
        assert cost_keys, f"No cost in response: {body}"

# ------------- Resource buffs -------------

class TestResourceBuffs:
    def test_available_endpoint(self, admin_token):
        r = requests.get(f"{API}/resource-buffs/available", headers=auth_header(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "buffs" in body
        assert isinstance(body["buffs"], list)
        assert len(body["buffs"]) == 7, f"Expected 7 T3 buffs, got {len(body['buffs'])}"
        sample = body["buffs"][0]
        for key in ["resource_id", "buff_name", "duration_days", "effect_type", "effect_value"]:
            assert key in sample, f"Missing {key} in {sample}"
        assert "already_active" in sample or "can_activate" in sample
        assert "active" in body

    def test_activate_third_buff_rejected(self, admin_token, mongo):
        # Admin currently has 2 active buffs per seed. Activating another should fail.
        # Verify we have 2 actives first
        user = mongo.users.find_one({"email": ADMIN_EMAIL})
        active = user.get("active_resource_buffs", []) if user else []
        if len(active) < 2:
            pytest.skip(f"Admin does not have 2 active buffs, has {len(active)}. Skipping limit test.")
        r = requests.post(f"{API}/resource-buffs/activate/war_protocol",
                          headers=auth_header(admin_token), timeout=10)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        assert "Максимум 2" in r.text or "max" in r.text.lower() or "2" in r.text
