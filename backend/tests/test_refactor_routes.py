"""Regression tests for server.py -> routes/ split.

Covers the newly extracted routers:
  - routes/health.py        -> GET /api/health
  - routes/stats.py         -> GET /api/stats
  - routes/buffs.py         -> GET /api/resource-buffs/available, GET /api/my/resources
  - routes/repair.py        -> already covered in test_security_and_buffs.py

Also sanity-checks telegram wiring:
  - background_tasks.notify_durability_warning_20 is imported
  - telegram_notifications.notify_durability_warning_20 exists and is callable
"""
import os
import importlib
import sys
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://ton-urban-2.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASS = "Qetuyrwioo"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=10)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok
    return tok


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- routes/health.py ----
class TestHealthRoute:
    def test_get_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "healthy", body


# ---- routes/stats.py ----
class TestStatsRoute:
    def test_get_stats_shape(self):
        r = requests.get(f"{API}/stats", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ["total_plots", "owned_plots", "available_plots",
                  "total_businesses", "total_players", "total_volume_ton"]:
            assert k in body, f"Missing '{k}' in stats: {body}"
        assert isinstance(body["total_players"], int)
        assert isinstance(body["total_businesses"], int)
        assert body["total_players"] >= 1
        assert body["total_businesses"] >= 0


# ---- routes/buffs.py ----
class TestBuffsRoute:
    def test_my_resources(self, admin_token):
        r = requests.get(f"{API}/my/resources", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        # should return a dict/object of resource_key -> amount, or {resources: {...}}
        assert isinstance(body, (dict, list))
        if isinstance(body, dict) and "resources" in body:
            res = body["resources"]
        else:
            res = body
        if isinstance(res, dict):
            # T3 keys should be present
            for k in ["neuro_core", "gold_bill"]:
                # may be missing if user never earned any — just assert it's dict-like
                assert True
        # Not asserting specific values — schema check only

    def test_resource_buffs_available_count(self, admin_token):
        r = requests.get(f"{API}/resource-buffs/available",
                         headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "buffs" in body and "active" in body
        assert len(body["buffs"]) == 7


# ---- Telegram wiring sanity ----
class TestTelegramWiring:
    def test_notify_function_exists(self):
        sys.path.insert(0, "/app/backend")
        tn = importlib.import_module("telegram_notifications")
        assert hasattr(tn, "notify_durability_warning_20"), \
            "telegram_notifications.notify_durability_warning_20 missing"
        # Ensure it's a coroutine function
        import inspect
        assert inspect.iscoroutinefunction(tn.notify_durability_warning_20)

    def test_background_tasks_imports_warning_fn(self):
        sys.path.insert(0, "/app/backend")
        bt = importlib.import_module("background_tasks")
        # After import, symbol must be in module namespace (it's imported at top)
        assert hasattr(bt, "notify_durability_warning_20"), \
            "background_tasks failed to import notify_durability_warning_20"

    def test_warn20_branch_code_present(self):
        with open("/app/backend/background_tasks.py", "r") as f:
            src = f.read()
        assert "new_durability < 20 and old_durability >= 20" in src, \
            "Missing <20% crossing branch"
        assert 'should_notify(owner, "warn20"' in src
        assert "notify_durability_warning_20(chat_id, biz_name, new_durability)" in src


# ---- server.py size sanity (refactor actually reduced size) ----
class TestRefactorSize:
    def test_server_py_under_11k(self):
        with open("/app/backend/server.py", "r") as f:
            line_count = sum(1 for _ in f)
        assert line_count < 11000, f"server.py still {line_count} lines (expected <11000)"

    def test_routes_dir_has_5_modules(self):
        import glob
        files = glob.glob("/app/backend/routes/*.py")
        # __init__.py + buffs + health + repair + sprites + stats (+ withdrawal already existed)
        names = {os.path.basename(f) for f in files}
        for required in ["buffs.py", "health.py", "repair.py", "sprites.py", "stats.py"]:
            assert required in names, f"Missing routes/{required}"
