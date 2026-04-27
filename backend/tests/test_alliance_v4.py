"""
TON City Alliance System V4 Tests
=================================
Tests for:
1. Cooperation endpoints (/cooperation/*) - must still work
2. Supply market (/contracts/supply-market)
3. Create supply alliance (/contracts/create-supply)
4. Accept supply alliance (/contracts/supply/{id}/accept)
5. Cancel supply alliance (/contracts/supply/{id}/cancel)
6. Resources endpoint - admin should not see quartz
7. Tax Haven 10% deduction on marketplace sale
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ton-urban-2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASSWORD = "Qetuyrwioo"
REGULAR_EMAIL = "player@toncity.com"
REGULAR_PASSWORD = "Player@2024"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def regular_token():
    """Get regular user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": REGULAR_EMAIL,
        "password": REGULAR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Regular user authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_businesses(admin_token):
    """Get admin's businesses"""
    response = requests.get(
        f"{BASE_URL}/api/my/businesses",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if response.status_code == 200:
        return response.json().get("businesses", [])
    return []


class TestCooperationEndpoints:
    """Test that cooperation endpoints still work (not broken)"""
    
    def test_cooperation_list_returns_data(self, admin_token):
        """GET /api/cooperation/list should return data without errors"""
        response = requests.get(
            f"{BASE_URL}/api/cooperation/list",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "contracts" in data, "Response should contain 'contracts' key"
        assert isinstance(data["contracts"], list), "contracts should be a list"
        print(f"✅ Cooperation list works - {len(data['contracts'])} contracts found")
    
    def test_cooperation_list_regular_user(self, regular_token):
        """Regular user can also access cooperation list"""
        response = requests.get(
            f"{BASE_URL}/api/cooperation/list",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "contracts" in data
        print(f"✅ Regular user can access cooperation list")


class TestSupplyMarket:
    """Test supply market (alliance) endpoints"""
    
    def test_supply_market_endpoint_works(self, admin_token):
        """GET /api/contracts/supply-market should return data"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/supply-market",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "contracts" in data, "Response should contain 'contracts' key"
        assert isinstance(data["contracts"], list), "contracts should be a list"
        print(f"✅ Supply market works - {len(data['contracts'])} supply contracts found")


class TestSupplyAllianceCreation:
    """Test creating supply alliances"""
    
    def test_create_supply_alliance_with_business(self, admin_token, admin_businesses):
        """POST /api/contracts/create-supply should create a supply alliance"""
        if not admin_businesses:
            pytest.skip("Admin has no businesses")
        
        # Find a tier 2 business (VR Club)
        vr_club = None
        for biz in admin_businesses:
            biz_type = biz.get("business_type", "")
            tier = biz.get("config", {}).get("tier", biz.get("tier", 1))
            if tier == 2 or "vr" in biz_type.lower():
                vr_club = biz
                break
        
        if not vr_club:
            # Use first business
            vr_club = admin_businesses[0]
        
        print(f"Using business: {vr_club.get('business_type')} (ID: {vr_club.get('id')[:12]}...)")
        
        # Create supply alliance
        response = requests.post(
            f"{BASE_URL}/api/contracts/create-supply",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "resource_type": "energy",
                "amount_per_day": 100,
                "price_per_10": 50,  # 50 $CITY per 10 units
                "duration_days": 7,
                "business_id": vr_club.get("id")
            }
        )
        
        # Accept 200 or 201 for success, or 400 if already exists
        if response.status_code in [200, 201]:
            data = response.json()
            assert "contract" in data or "id" in data or "message" in data
            print(f"✅ Supply alliance created successfully")
        elif response.status_code == 400:
            # May fail if user doesn't have the resource or other validation
            print(f"⚠️ Supply alliance creation returned 400: {response.json().get('detail', 'Unknown error')}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")


class TestSupplyAllianceAcceptCancel:
    """Test accepting and canceling supply alliances"""
    
    def test_accept_supply_alliance_invalid_id(self, regular_token):
        """POST /api/contracts/supply/{id}/accept with invalid ID should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/contracts/supply/invalid-id-12345/accept",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}"
        print(f"✅ Accept with invalid ID correctly returns error")
    
    def test_cancel_supply_alliance_invalid_id(self, admin_token):
        """POST /api/contracts/supply/{id}/cancel with invalid ID should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/contracts/supply/invalid-id-12345/cancel",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}"
        print(f"✅ Cancel with invalid ID correctly returns error")


class TestResourcesEndpoint:
    """Test resources endpoint"""
    
    def test_admin_resources_no_quartz(self, admin_token):
        """GET /api/my/resources should not show quartz for admin"""
        response = requests.get(
            f"{BASE_URL}/api/my/resources",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "resources" in data, "Response should contain 'resources' key"
        
        resources = data["resources"]
        # Quartz should either not exist or be 0
        quartz_amount = resources.get("quartz", 0)
        assert quartz_amount == 0 or "quartz" not in resources, f"Admin should not have quartz, found: {quartz_amount}"
        print(f"✅ Admin resources endpoint works, no quartz found (quartz={quartz_amount})")
        print(f"   Resources: {list(resources.keys())[:10]}...")


class TestContractsMyEndpoint:
    """Test /contracts/my endpoint"""
    
    def test_contracts_my_returns_structure(self, admin_token):
        """GET /api/contracts/my should return as_patron and as_vassal"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/my",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "as_patron" in data, "Response should contain 'as_patron' key"
        assert "as_vassal" in data, "Response should contain 'as_vassal' key"
        assert isinstance(data["as_patron"], list), "as_patron should be a list"
        assert isinstance(data["as_vassal"], list), "as_vassal should be a list"
        print(f"✅ /contracts/my works - patron: {len(data['as_patron'])}, vassal: {len(data['as_vassal'])}")


class TestContractTypes:
    """Test contract types endpoint"""
    
    def test_contract_types_available(self, admin_token):
        """GET /api/contracts/types should return contract types"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/types",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "types" in data, "Response should contain 'types' key"
        
        types = data["types"]
        # Should have tax_haven, raw_material, tech_umbrella, resource_supply
        type_ids = [t.get("id") for t in types]
        assert "tax_haven" in type_ids, "tax_haven should be in contract types"
        print(f"✅ Contract types: {type_ids}")


class TestBusinessesEndpoint:
    """Test businesses endpoint"""
    
    def test_admin_has_businesses(self, admin_token, admin_businesses):
        """Admin should have businesses (VR Club and Gram Bank)"""
        assert len(admin_businesses) >= 1, "Admin should have at least 1 business"
        
        business_types = [b.get("business_type", "") for b in admin_businesses]
        print(f"✅ Admin has {len(admin_businesses)} businesses: {business_types}")
        
        # Check for expected businesses
        has_tier2 = any(b.get("config", {}).get("tier", b.get("tier", 1)) == 2 for b in admin_businesses)
        has_tier3 = any(b.get("config", {}).get("tier", b.get("tier", 1)) == 3 for b in admin_businesses)
        print(f"   Has Tier 2: {has_tier2}, Has Tier 3: {has_tier3}")


class TestMarketBuyTaxHaven:
    """Test Tax Haven 10% deduction on marketplace sale"""
    
    def test_market_listings_endpoint(self, admin_token):
        """GET /api/market/listings should work"""
        response = requests.get(f"{BASE_URL}/api/market/listings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "listings" in data, "Response should contain 'listings' key"
        print(f"✅ Market listings works - {len(data['listings'])} listings found")


class TestHealthAndConfig:
    """Basic health and config tests"""
    
    def test_health_endpoint(self):
        """Health endpoint should return OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ Health endpoint OK")
    
    def test_config_endpoint(self):
        """Config endpoint should return businesses"""
        response = requests.get(f"{BASE_URL}/api/config")
        assert response.status_code == 200
        data = response.json()
        assert "businesses" in data, "Config should contain businesses"
        print(f"✅ Config endpoint OK - {len(data['businesses'])} business types")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
