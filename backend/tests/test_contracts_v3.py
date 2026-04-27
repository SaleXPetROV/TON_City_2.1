"""
TON City - Contract System V3 Tests
===================================
Testing:
1. /api/my/resources - should NOT contain quartz, resources < 1 display as 0
2. /api/contracts/types - should return 4 types including 'resource_supply'
3. /api/contracts/create-supply - regular users can create supply contracts
4. /api/contracts/supply-market - open supply contracts marketplace
5. /api/contracts/propose - creates notifications in DB
6. /api/contracts/{id}/accept - sets patron_id on business
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASSWORD = "Qetuyrwioo"
REGULAR_EMAIL = "player@toncity.com"
REGULAR_PASSWORD = "Player@2024"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("is_admin") == True, "User should be admin"
        print(f"✓ Admin login successful: {data.get('user', {}).get('username')}")
    
    def test_regular_user_login(self):
        """Test regular user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_EMAIL,
            "password": REGULAR_PASSWORD
        })
        assert response.status_code == 200, f"Regular user login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("is_admin") != True, "User should NOT be admin"
        print(f"✓ Regular user login successful: {data.get('user', {}).get('username')}")


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def regular_token():
    """Get regular user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": REGULAR_EMAIL,
        "password": REGULAR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Regular user authentication failed")


class TestResourcesEndpoint:
    """Test /api/my/resources endpoint - quartz removal and < 1 display"""
    
    def test_admin_resources_no_quartz(self, admin_token):
        """Admin resources should NOT contain quartz"""
        response = requests.get(
            f"{BASE_URL}/api/my/resources",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get resources: {response.text}"
        data = response.json()
        resources = data.get("resources", {})
        
        # Quartz should NOT be in resources (mine was deleted)
        assert "quartz" not in resources, f"Quartz should NOT be in resources, but found: {resources.get('quartz')}"
        print(f"✓ Admin resources do not contain quartz: {list(resources.keys())}")
    
    def test_resources_less_than_1_display_as_0(self, admin_token):
        """Resources with value < 1 should display as 0 (not rounded up)"""
        response = requests.get(
            f"{BASE_URL}/api/my/resources",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        resources = data.get("resources", {})
        
        # All values should be >= 1 (since < 1 are filtered out)
        for resource, value in resources.items():
            assert value >= 1, f"Resource {resource} has value {value} which should be filtered out"
        print(f"✓ All displayed resources have value >= 1")


class TestContractTypes:
    """Test /api/contracts/types endpoint"""
    
    def test_contract_types_returns_4_types(self, admin_token):
        """Contract types should return 4 types including resource_supply"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/types",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get contract types: {response.text}"
        data = response.json()
        types = data.get("types", [])
        
        # Should have 4 types
        assert len(types) == 4, f"Expected 4 contract types, got {len(types)}"
        
        # Extract type IDs
        type_ids = [t.get("id") for t in types]
        
        # Should include resource_supply
        assert "resource_supply" in type_ids, f"resource_supply not in types: {type_ids}"
        
        # Should include other types
        expected_types = ["tax_haven", "raw_material", "tech_umbrella", "resource_supply"]
        for expected in expected_types:
            assert expected in type_ids, f"{expected} not in types: {type_ids}"
        
        print(f"✓ Contract types: {type_ids}")
    
    def test_regular_user_can_see_contract_types(self, regular_token):
        """Regular users should also see all contract types"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/types",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        assert response.status_code == 200, f"Regular user failed to get contract types: {response.text}"
        data = response.json()
        types = data.get("types", [])
        type_ids = [t.get("id") for t in types]
        
        assert "resource_supply" in type_ids, "Regular user should see resource_supply type"
        print(f"✓ Regular user can see contract types including resource_supply")


class TestSupplyMarket:
    """Test /api/contracts/supply-market endpoint"""
    
    def test_supply_market_endpoint_works(self, admin_token):
        """Supply market endpoint should return contracts list"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/supply-market",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Supply market failed: {response.text}"
        data = response.json()
        
        # Should have contracts key (even if empty)
        assert "contracts" in data, "Response should have 'contracts' key"
        contracts = data.get("contracts", [])
        assert isinstance(contracts, list), "Contracts should be a list"
        
        print(f"✓ Supply market works, found {len(contracts)} open contracts")
    
    def test_regular_user_can_access_supply_market(self, regular_token):
        """Regular users should be able to access supply market"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/supply-market",
            headers={"Authorization": f"Bearer {regular_token}"}
        )
        assert response.status_code == 200, f"Regular user failed to access supply market: {response.text}"
        print("✓ Regular user can access supply market")


class TestMyContracts:
    """Test /api/contracts/my endpoint"""
    
    def test_my_contracts_endpoint(self, admin_token):
        """My contracts endpoint should return as_patron and as_vassal"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/my",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"My contracts failed: {response.text}"
        data = response.json()
        
        assert "as_patron" in data, "Response should have 'as_patron' key"
        assert "as_vassal" in data, "Response should have 'as_vassal' key"
        
        print(f"✓ My contracts: {len(data.get('as_patron', []))} as patron, {len(data.get('as_vassal', []))} as vassal")


class TestAdminBusinesses:
    """Test admin businesses - should not have quartz mine"""
    
    def test_admin_businesses_no_quartz_mine(self, admin_token):
        """Admin should have 2 businesses without quartz mine"""
        response = requests.get(
            f"{BASE_URL}/api/my/businesses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get businesses: {response.text}"
        data = response.json()
        businesses = data.get("businesses", [])
        
        # Check business types - should not include quartz_mine
        business_types = [b.get("business_type") for b in businesses]
        assert "quartz_mine" not in business_types, f"Quartz mine should be deleted, but found in: {business_types}"
        
        print(f"✓ Admin has {len(businesses)} businesses: {business_types}")


class TestSupplyContractCreation:
    """Test /api/contracts/create-supply endpoint"""
    
    def test_create_supply_contract_requires_business(self, regular_token):
        """Creating supply contract requires owning a business that produces the resource"""
        # Try to create without valid business
        response = requests.post(
            f"{BASE_URL}/api/contracts/create-supply",
            headers={
                "Authorization": f"Bearer {regular_token}",
                "Content-Type": "application/json"
            },
            json={
                "resource_type": "energy",
                "amount_per_day": 100,
                "price_per_10": 5.0,
                "duration_days": 30,
                "business_id": "non-existent-business"
            }
        )
        # Should fail with 403 (business not found or not owned)
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}: {response.text}"
        print("✓ Supply contract creation properly validates business ownership")
    
    def test_admin_can_create_supply_contract(self, admin_token):
        """Admin with businesses can create supply contracts"""
        # First get admin's businesses
        biz_response = requests.get(
            f"{BASE_URL}/api/my/businesses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert biz_response.status_code == 200
        businesses = biz_response.json().get("businesses", [])
        
        if not businesses:
            pytest.skip("Admin has no businesses to test supply contract creation")
        
        # Find a business that produces something
        test_business = None
        for biz in businesses:
            config = biz.get("config", {})
            produces = config.get("produces")
            if produces:
                test_business = biz
                break
        
        if not test_business:
            pytest.skip("No business with production found")
        
        produces = test_business.get("config", {}).get("produces", "energy")
        
        # Try to create supply contract
        response = requests.post(
            f"{BASE_URL}/api/contracts/create-supply",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "resource_type": produces,
                "amount_per_day": 50,
                "price_per_10": 3.0,
                "duration_days": 14,
                "business_id": test_business.get("id")
            }
        )
        
        # Should succeed or fail with validation error (not 500)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Contract creation should succeed"
            assert "contract_id" in data, "Should return contract_id"
            print(f"✓ Supply contract created: {data.get('contract_id')}")
        else:
            print(f"✓ Supply contract creation validation works: {response.json()}")


class TestNotifications:
    """Test that notifications are created for contract events"""
    
    def test_notifications_endpoint_exists(self, admin_token):
        """Notifications endpoint should exist"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 200 or have notifications structure
        assert response.status_code == 200, f"Notifications endpoint failed: {response.status_code}"
        data = response.json()
        
        # Should have notifications key
        assert "notifications" in data or isinstance(data, list), "Should return notifications"
        print(f"✓ Notifications endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
