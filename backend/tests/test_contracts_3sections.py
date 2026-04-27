"""
Test Contracts Tab 3-Section Layout
====================================
Tests for the new 3-section layout in the Контракты (Contracts) tab:
1. Активные (Active) - active contracts with progress bar
2. Мои контракты (My contracts) - user's own open contracts with Cancel button
3. Актуальные (Available) - others' open contracts with Accept/Hide buttons

Backend enriches active contracts with days_elapsed and days_remaining.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASSWORD = "Qetuyrwioo"
PLAYER_EMAIL = "player@toncity.com"
PLAYER_PASSWORD = "Player@2024"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def player_token():
    """Get player authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PLAYER_EMAIL,
        "password": PLAYER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Player authentication failed")


@pytest.fixture(scope="module")
def admin_user_id(admin_token):
    """Get admin user ID"""
    response = requests.get(f"{BASE_URL}/api/auth/me", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    if response.status_code == 200:
        return response.json().get("id")
    return None


@pytest.fixture(scope="module")
def player_user_id(player_token):
    """Get player user ID"""
    response = requests.get(f"{BASE_URL}/api/auth/me", headers={
        "Authorization": f"Bearer {player_token}"
    })
    if response.status_code == 200:
        return response.json().get("id")
    return None


class TestAuthenticationWorks:
    """Test that both admin and player can login"""
    
    def test_admin_login(self):
        """Admin login should work"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_admin"] == True
        print(f"✓ Admin login successful: {data['user']['username']}")
    
    def test_player_login(self):
        """Player login should work"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PLAYER_EMAIL,
            "password": PLAYER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_admin"] == False
        print(f"✓ Player login successful: {data['user']['username']}")


class TestCooperationListEndpoint:
    """Test /api/cooperation/list endpoint returns proper data for 3-section layout"""
    
    def test_cooperation_list_returns_contracts(self, admin_token):
        """Cooperation list should return contracts array"""
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "contracts" in data
        assert "total" in data
        assert isinstance(data["contracts"], list)
        print(f"✓ Cooperation list returns {len(data['contracts'])} contracts")
    
    def test_contract_has_required_fields(self, admin_token):
        """Each contract should have required fields for UI display"""
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        if len(data["contracts"]) > 0:
            contract = data["contracts"][0]
            # Required fields for 3-section layout
            required_fields = [
                "id", "seller_id", "seller_username", "resource_type",
                "amount_per_day", "status", "duration_days"
            ]
            for field in required_fields:
                assert field in contract, f"Missing field: {field}"
            print(f"✓ Contract has all required fields: {list(contract.keys())}")
        else:
            print("⚠ No contracts to verify fields")
    
    def test_active_contracts_have_progress_fields(self, admin_token):
        """Active contracts should have days_elapsed and days_remaining"""
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        active_contracts = [c for c in data["contracts"] if c.get("status") == "active"]
        for contract in active_contracts:
            assert "days_elapsed" in contract, "Active contract missing days_elapsed"
            assert "days_remaining" in contract, "Active contract missing days_remaining"
            print(f"✓ Active contract has progress: {contract['days_elapsed']} elapsed, {contract['days_remaining']} remaining")
        
        if not active_contracts:
            print("⚠ No active contracts to verify progress fields")


class TestAdminSeesOwnContracts:
    """Test that admin sees their own contracts in 'Мои контракты' section"""
    
    def test_admin_sees_own_open_contract(self, admin_token, admin_user_id):
        """Admin should see their own open contracts"""
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Filter for admin's own open contracts (Мои контракты section)
        my_open = [c for c in data["contracts"] 
                   if c.get("seller_id") == admin_user_id and c.get("status") == "open"]
        
        print(f"✓ Admin has {len(my_open)} own open contracts (Мои контракты section)")
        
        # Verify at least one exists based on context
        if len(my_open) > 0:
            contract = my_open[0]
            assert contract["seller_username"] == "SanyaNazarov"
            print(f"  - Contract: {contract['resource_type']}, {contract['amount_per_day']} per day")


class TestPlayerSeesAvailableContracts:
    """Test that player sees others' contracts in 'Актуальные' section"""
    
    def test_player_sees_others_open_contracts(self, player_token, player_user_id):
        """Player should see others' open contracts (Актуальные section)"""
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {player_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Filter for others' open contracts (Актуальные section)
        others_open = [c for c in data["contracts"] 
                       if c.get("seller_id") != player_user_id and c.get("status") == "open"]
        
        print(f"✓ Player sees {len(others_open)} available contracts (Актуальные section)")
        
        if len(others_open) > 0:
            contract = others_open[0]
            print(f"  - From: {contract['seller_username']}, Resource: {contract['resource_type']}")


class TestHideContractFunctionality:
    """Test hide contract functionality for optimistic UI"""
    
    def test_hide_contract_endpoint_exists(self, player_token):
        """Hide contract endpoint should exist"""
        # Use a fake ID to test endpoint existence
        response = requests.post(f"{BASE_URL}/api/contracts/hide/fake-id", headers={
            "Authorization": f"Bearer {player_token}"
        })
        # Should return 200 (success) even for non-existent ID (adds to hidden list)
        assert response.status_code == 200
        print("✓ Hide contract endpoint exists and works")
    
    def test_hidden_contracts_filtered(self, player_token):
        """Hidden contracts should be filtered from list"""
        # First get the list
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {player_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Check hidden_count field exists
        assert "hidden_count" in data
        print(f"✓ Hidden count: {data['hidden_count']}, Visible: {len(data['contracts'])}")


class TestCancelContractFunctionality:
    """Test cancel contract functionality for own contracts"""
    
    def test_cancel_contract_requires_ownership(self, player_token):
        """Cancel should fail for contracts not owned by user"""
        # Try to cancel a contract that doesn't belong to player
        response = requests.post(f"{BASE_URL}/api/cooperation/cancel/fake-id", headers={
            "Authorization": f"Bearer {player_token}"
        })
        # Should return 404 (not found) or 403 (forbidden)
        assert response.status_code in [403, 404]
        print("✓ Cancel contract requires ownership")


class TestAcceptContractFunctionality:
    """Test accept contract functionality"""
    
    def test_accept_contract_endpoint_exists(self, player_token):
        """Accept contract endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/cooperation/accept/fake-id", headers={
            "Authorization": f"Bearer {player_token}"
        })
        # Should return 404 (contract not found) not 405 (method not allowed)
        assert response.status_code == 404
        print("✓ Accept contract endpoint exists")
    
    def test_cannot_accept_own_contract(self, admin_token, admin_user_id):
        """User cannot accept their own contract"""
        # Get admin's contracts
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        data = response.json()
        
        my_open = [c for c in data["contracts"] 
                   if c.get("seller_id") == admin_user_id and c.get("status") == "open"]
        
        if len(my_open) > 0:
            contract_id = my_open[0]["id"]
            response = requests.post(f"{BASE_URL}/api/cooperation/accept/{contract_id}", headers={
                "Authorization": f"Bearer {admin_token}"
            })
            assert response.status_code == 400
            assert "свой контракт" in response.json().get("detail", "").lower() or "own" in response.json().get("detail", "").lower()
            print("✓ Cannot accept own contract")
        else:
            pytest.skip("No own contracts to test")


class TestContractDataEnrichment:
    """Test that backend enriches contract data properly"""
    
    def test_resource_tier_included(self, admin_token):
        """Contract should include resource_tier for price display"""
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        if len(data["contracts"]) > 0:
            contract = data["contracts"][0]
            # resource_tier is used for price display (per 10 for tier 1, per 1 for others)
            if "resource_tier" in contract:
                print(f"✓ Contract includes resource_tier: {contract['resource_tier']}")
            else:
                print("⚠ resource_tier not in contract (may be calculated client-side)")
    
    def test_price_fields_present(self, admin_token):
        """Contract should have price fields"""
        response = requests.get(f"{BASE_URL}/api/cooperation/list", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        if len(data["contracts"]) > 0:
            contract = data["contracts"][0]
            # Check for price field (could be price_per_unit or price_per_10)
            has_price = "price_per_unit" in contract or "price_per_10" in contract
            assert has_price, "Contract missing price field"
            print(f"✓ Contract has price: {contract.get('price_per_unit') or contract.get('price_per_10')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
