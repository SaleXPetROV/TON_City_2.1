"""
Tests for:
- P0: Cancel market listing (DELETE & POST) returns resources to user.resources
- P1: Durability multiplier is 0.8 for 5-50% range
- Regression: Buy from market still works
"""
import pytest
import requests
import os
import sys

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PLAYER_EMAIL = "player@toncity.com"
PLAYER_PASSWORD = "Player@2024"
ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASSWORD = "Qetuyrwioo"


@pytest.fixture(scope="module")
def player_token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": PLAYER_EMAIL, "password": PLAYER_PASSWORD})
    if res.status_code != 200:
        pytest.skip(f"Player login failed: {res.status_code} {res.text}")
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if res.status_code != 200:
        pytest.skip(f"Admin login failed: {res.status_code} {res.text}")
    return res.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def get_user_resources(token):
    res = requests.get(f"{BASE_URL}/api/profile", headers=auth_headers(token))
    assert res.status_code == 200, f"Profile fetch failed: {res.text}"
    data = res.json()
    return data.get("resources", {})


# ==================== P1: Durability multiplier ====================

class TestDurabilityMultiplier:
    """Test durability multiplier logic via background_tasks import"""
    
    def test_durability_above_50_returns_1(self):
        """50%+ durability should return 1.0 multiplier"""
        sys.path.insert(0, '/app/backend')
        from background_tasks import get_durability_multiplier
        assert get_durability_multiplier(100) == 1.0
        assert get_durability_multiplier(50) == 1.0
        assert get_durability_multiplier(75) == 1.0

    def test_durability_5_to_50_returns_0_8(self):
        """5-50% (exclusive) durability should return 0.8 multiplier"""
        sys.path.insert(0, '/app/backend')
        from background_tasks import get_durability_multiplier
        # The function: if durability < 50: return 0.8
        assert get_durability_multiplier(49) == 0.8
        assert get_durability_multiplier(25) == 0.8
        assert get_durability_multiplier(5) == 0.8
        assert get_durability_multiplier(1) == 0.8

    def test_durability_zero_returns_0(self):
        """0% durability should stop production"""
        sys.path.insert(0, '/app/backend')
        from background_tasks import get_durability_multiplier
        assert get_durability_multiplier(0) == 0.0

    def test_durability_not_0_7(self):
        """Verify old 0.7 multiplier is gone, now 0.8"""
        sys.path.insert(0, '/app/backend')
        from background_tasks import get_durability_multiplier
        result = get_durability_multiplier(25)
        assert result == 0.8, f"Expected 0.8 but got {result} - old 0.7 multiplier may still be in use"


# ==================== P0: Cancel listing via DELETE ====================

class TestCancelMarketListingDELETE:
    """Test DELETE /api/market/listing/{id} returns resources to user"""

    def test_cancel_listing_delete_returns_resources(self, admin_token):
        """Create listing, cancel via DELETE, verify resources restored"""
        # Get initial resources
        initial_resources = get_user_resources(admin_token)
        initial_scrap = initial_resources.get("scrap", 0)
        print(f"Initial scrap: {initial_scrap}")
        
        # Need at least 10 scrap to list
        if initial_scrap < 10:
            pytest.skip(f"Not enough scrap ({initial_scrap}) to test listing")
        
        # Create a listing of 10 scrap
        list_res = requests.post(
            f"{BASE_URL}/api/market/list-resource",
            headers=auth_headers(admin_token),
            json={"resource_type": "scrap", "amount": 10, "price_per_unit": 0.001}
        )
        assert list_res.status_code == 200, f"List resource failed: {list_res.text}"
        listing_id = list_res.json()["listing"]["id"]
        print(f"Created listing: {listing_id}")
        
        # Verify resources decreased
        after_list_resources = get_user_resources(admin_token)
        after_list_scrap = after_list_resources.get("scrap", 0)
        assert after_list_scrap == initial_scrap - 10, f"Scrap should decrease by 10: {initial_scrap} -> {after_list_scrap}"
        print(f"After listing scrap: {after_list_scrap}")
        
        # Cancel via DELETE
        cancel_res = requests.delete(
            f"{BASE_URL}/api/market/listing/{listing_id}",
            headers=auth_headers(admin_token)
        )
        assert cancel_res.status_code == 200, f"Cancel DELETE failed: {cancel_res.text}"
        data = cancel_res.json()
        assert data.get("status") == "cancelled"
        print(f"Cancel response: {data}")
        
        # Verify resources restored
        after_cancel_resources = get_user_resources(admin_token)
        after_cancel_scrap = after_cancel_resources.get("scrap", 0)
        assert after_cancel_scrap == initial_scrap, (
            f"Resources not restored! Initial: {initial_scrap}, After cancel: {after_cancel_scrap}"
        )
        print(f"After cancel scrap: {after_cancel_scrap} - RESTORED ✓")

    def test_cancel_listing_delete_not_found(self, admin_token):
        """DELETE non-existent listing returns 404"""
        res = requests.delete(
            f"{BASE_URL}/api/market/listing/nonexistent-id-xyz",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 404


# ==================== P0: Cancel listing via POST ====================

class TestCancelMarketListingPOST:
    """Test POST /api/market/cancel/{id} returns resources to user"""

    def test_cancel_listing_post_returns_resources(self, admin_token):
        """Create listing, cancel via POST, verify resources restored"""
        initial_resources = get_user_resources(admin_token)
        initial_energy = initial_resources.get("energy", 0)
        print(f"Initial energy: {initial_energy}")
        
        if initial_energy < 10:
            pytest.skip(f"Not enough energy ({initial_energy}) to test listing")
        
        # Create listing of 10 energy
        list_res = requests.post(
            f"{BASE_URL}/api/market/list-resource",
            headers=auth_headers(admin_token),
            json={"resource_type": "energy", "amount": 10, "price_per_unit": 0.001}
        )
        assert list_res.status_code == 200, f"List resource failed: {list_res.text}"
        listing_id = list_res.json()["listing"]["id"]
        print(f"Created listing: {listing_id}")
        
        # Verify resources decreased
        after_list_resources = get_user_resources(admin_token)
        after_list_energy = after_list_resources.get("energy", 0)
        assert after_list_energy == initial_energy - 10, f"Energy should decrease by 10: {initial_energy} -> {after_list_energy}"
        
        # Cancel via POST
        cancel_res = requests.post(
            f"{BASE_URL}/api/market/cancel/{listing_id}",
            headers=auth_headers(admin_token)
        )
        assert cancel_res.status_code == 200, f"Cancel POST failed: {cancel_res.text}"
        data = cancel_res.json()
        assert data.get("status") == "cancelled"
        print(f"Cancel POST response: {data}")
        
        # Verify resources restored
        after_cancel_resources = get_user_resources(admin_token)
        after_cancel_energy = after_cancel_resources.get("energy", 0)
        assert after_cancel_energy == initial_energy, (
            f"Resources not restored! Initial: {initial_energy}, After cancel: {after_cancel_energy}"
        )
        print(f"After cancel energy: {after_cancel_energy} - RESTORED ✓")


# ==================== Regression: Buy from market ====================

class TestBuyFromMarket:
    """Regression: Buy resource from market still works"""

    def test_buy_from_market_returns_new_balance(self, admin_token, player_token):
        """Admin lists resource, player buys it, verify new_balance in response"""
        # Admin lists 10 scrap
        admin_resources = get_user_resources(admin_token)
        if admin_resources.get("scrap", 0) < 10:
            pytest.skip("Admin needs scrap to create listing")
        
        list_res = requests.post(
            f"{BASE_URL}/api/market/list-resource",
            headers=auth_headers(admin_token),
            json={"resource_type": "scrap", "amount": 10, "price_per_unit": 0.0001}
        )
        assert list_res.status_code == 200, f"List failed: {list_res.text}"
        listing_id = list_res.json()["listing"]["id"]
        print(f"Created listing for buy test: {listing_id}")
        
        # Player buys 10 scrap
        buy_res = requests.post(
            f"{BASE_URL}/api/market/buy",
            headers=auth_headers(player_token),
            json={"listing_id": listing_id, "amount": 10}
        )
        assert buy_res.status_code == 200, f"Buy failed: {buy_res.text}"
        data = buy_res.json()
        
        # Verify new_balance is in response
        assert "new_balance" in data, f"new_balance not in buy response: {data}"
        assert isinstance(data["new_balance"], (int, float)), f"new_balance should be numeric: {data['new_balance']}"
        print(f"Buy response new_balance: {data['new_balance']}")
        
        # Verify total_paid is present
        assert "total_paid" in data or "amount_paid" in data, f"Payment info missing: {data}"
        print(f"Buy test PASSED: new_balance={data['new_balance']}")


# ==================== P3: No patrons in businesses ====================

class TestNoPatrons:
    """P3: Verify businesses have no patrons"""

    def test_businesses_have_no_patrons(self, admin_token):
        """Check admin businesses - no patrons should remain"""
        res = requests.get(f"{BASE_URL}/api/my/businesses", headers=auth_headers(admin_token))
        assert res.status_code == 200, f"Get businesses failed: {res.text}"
        
        businesses = res.json().get("businesses", [])
        assert len(businesses) > 0, "Admin should have businesses"
        
        for biz in businesses:
            patrons = biz.get("patrons", [])
            patron_count = len(patrons) if isinstance(patrons, list) else patrons
            print(f"Business {biz.get('type', biz.get('id'))}: patrons={patron_count}")
            assert patron_count == 0, f"Business {biz.get('type')} still has patrons: {patrons}"
        
        print("All businesses have 0 patrons ✓")
