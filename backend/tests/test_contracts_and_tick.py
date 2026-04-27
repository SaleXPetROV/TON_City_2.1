"""
Tests for:
- P0 bug fix: economic tick processes businesses
- Contract endpoints: GET /api/contracts/my, GET /api/contracts/types, POST /api/contracts/propose
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "sanyanazarov212@gmail.com",
        "password": "Qetuyrwioo"
    })
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# === Contract endpoint tests ===

def test_contracts_types_returns_3():
    """GET /api/contracts/types should return 3 types"""
    resp = requests.get(f"{BASE_URL}/api/contracts/types")
    assert resp.status_code == 200
    data = resp.json()
    assert "types" in data
    type_ids = [t["id"] for t in data["types"]]
    assert "tax_haven" in type_ids
    assert "raw_material" in type_ids
    assert "tech_umbrella" in type_ids
    assert len(data["types"]) == 3


def test_contracts_my_requires_auth():
    """GET /api/contracts/my should require auth"""
    resp = requests.get(f"{BASE_URL}/api/contracts/my")
    assert resp.status_code in [401, 403]


def test_contracts_my_returns_structure(auth_headers):
    """GET /api/contracts/my should return {as_patron: [], as_vassal: []}"""
    resp = requests.get(f"{BASE_URL}/api/contracts/my", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "as_patron" in data
    assert "as_vassal" in data
    assert isinstance(data["as_patron"], list)
    assert isinstance(data["as_vassal"], list)


def test_propose_contract_requires_auth():
    """POST /api/contracts/propose without auth should return 401/403"""
    resp = requests.post(f"{BASE_URL}/api/contracts/propose", json={})
    assert resp.status_code in [401, 403]


def test_propose_contract_invalid_vassal(auth_headers):
    """POST /api/contracts/propose with invalid vassal should return 400 or 404"""
    resp = requests.post(f"{BASE_URL}/api/contracts/propose", headers=auth_headers, json={
        "vassal_id": "nonexistent-user-id",
        "vassal_business_id": "nonexistent-biz-id",
        "type": "tax_haven",
        "patron_buff": "Test buff"
    })
    # Should not return 500; expect 400/404
    assert resp.status_code in [400, 404, 422]
    assert resp.status_code != 500


# === Economic tick test (verify businesses are being processed) ===

def test_businesses_accessible(auth_headers):
    """GET /api/businesses should return businesses for admin"""
    resp = requests.get(f"{BASE_URL}/api/businesses", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "businesses" in data
    assert len(data["businesses"]) > 0


def test_quartz_mine_has_produced_resources(auth_headers):
    """Quartz mine should have quartz in storage (confirming tick is working)"""
    resp = requests.get(f"{BASE_URL}/api/businesses", headers=auth_headers)
    assert resp.status_code == 200
    businesses = resp.json()["businesses"]
    quartz_mine = next((b for b in businesses if b["business_type"] == "quartz_mine"), None)
    assert quartz_mine is not None, "quartz_mine business not found"
    # Storage should have quartz > 0 since tick is running
    storage_items = quartz_mine.get("storage", {}).get("items", {})
    quartz_amount = storage_items.get("quartz", 0)
    assert quartz_amount > 0, f"Quartz mine has no quartz in storage (amount={quartz_amount}). Tick may not be processing."
