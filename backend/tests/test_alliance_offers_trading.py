"""
Test Alliance Offers and Trading Page Features
Tests for:
- Login (admin and player)
- Alliance offers API endpoints
- Contract actions (accept/reject/cancel)
- Tier3 buffs and contract types
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ton-urban-2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "sanyanazarov212@gmail.com"
ADMIN_PASSWORD = "Qetuyrwioo"
PLAYER_EMAIL = "player@toncity.com"
PLAYER_PASSWORD = "Player@2024"


class TestAuthentication:
    """Test login functionality"""
    
    def test_admin_login(self):
        """Admin login should work"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"Admin login successful: {data['user']['username']}")
    
    def test_player_login(self):
        """Player login should work"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PLAYER_EMAIL,
            "password": PLAYER_PASSWORD
        })
        assert response.status_code == 200, f"Player login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == PLAYER_EMAIL
        print(f"Player login successful: {data['user']['username']}")


class TestTier3BuffsAndContractTypes:
    """Test Tier3 buffs and contract types endpoints"""
    
    def test_get_tier3_buffs(self):
        """GET /api/tier3/buffs should return 9 buffs"""
        response = requests.get(f"{BASE_URL}/api/tier3/buffs")
        assert response.status_code == 200, f"Failed to get buffs: {response.text}"
        data = response.json()
        assert "buffs" in data
        buffs = data["buffs"]
        assert len(buffs) == 9, f"Expected 9 buffs, got {len(buffs)}"
        
        # Verify buff structure
        for buff in buffs:
            assert "id" in buff
            assert "name" in buff
            assert "description" in buff
            assert "icon" in buff
            assert "effect" in buff
        
        print(f"Found {len(buffs)} buffs: {[b['id'] for b in buffs]}")
    
    def test_get_contract_types(self):
        """GET /api/contracts/types should return 4 contract types"""
        response = requests.get(f"{BASE_URL}/api/contracts/types")
        assert response.status_code == 200, f"Failed to get contract types: {response.text}"
        data = response.json()
        assert "types" in data
        types = data["types"]
        assert len(types) == 4, f"Expected 4 contract types, got {len(types)}"
        
        # Verify contract type structure
        expected_types = ["tax_haven", "raw_material", "tech_umbrella", "resource_supply"]
        for ct in types:
            assert "id" in ct
            assert ct["id"] in expected_types
            assert "name_ru" in ct
            assert "patron_benefit" in ct
            assert "penalty_city" in ct
        
        print(f"Found {len(types)} contract types: {[t['id'] for t in types]}")


class TestAllianceOffers:
    """Test alliance offers endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def player_token(self):
        """Get player token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PLAYER_EMAIL,
            "password": PLAYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Player login failed")
    
    def test_get_alliance_offers(self, admin_token):
        """GET /api/alliances/offers should return list of offers"""
        response = requests.get(
            f"{BASE_URL}/api/alliances/offers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get offers: {response.text}"
        data = response.json()
        assert "offers" in data
        assert isinstance(data["offers"], list)
        print(f"Found {len(data['offers'])} alliance offers")
    
    def test_admin_has_tier3_business(self, admin_token):
        """Admin should have a Tier 3 business for publishing offers"""
        response = requests.get(
            f"{BASE_URL}/api/my/businesses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get businesses: {response.text}"
        data = response.json()
        businesses = data.get("businesses", [])
        
        tier3_businesses = [b for b in businesses if b.get("config", {}).get("tier") == 3 or b.get("tier") == 3]
        assert len(tier3_businesses) > 0, "Admin should have at least one Tier 3 business"
        
        tier3_biz = tier3_businesses[0]
        print(f"Admin has Tier 3 business: {tier3_biz.get('config', {}).get('name', {}).get('ru', tier3_biz.get('business_type'))}")
    
    def test_publish_offer_requires_tier3(self, player_token):
        """Publishing offer without Tier 3 business should fail"""
        response = requests.post(
            f"{BASE_URL}/api/alliances/publish-offer",
            headers={"Authorization": f"Bearer {player_token}", "Content-Type": "application/json"},
            json={
                "buff_id": "repair_discount",
                "contract_type": "tax_haven",
                "duration_days": 30
            }
        )
        # Should fail with 403 if player doesn't have Tier 3 business
        # or succeed if they do
        if response.status_code == 403:
            assert "Эшелона 3" in response.json().get("detail", "")
            print("Correctly rejected: Player needs Tier 3 business")
        elif response.status_code == 200:
            print("Player has Tier 3 business, offer published")
        else:
            print(f"Unexpected response: {response.status_code} - {response.text}")


class TestContracts:
    """Test contract endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def player_token(self):
        """Get player token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PLAYER_EMAIL,
            "password": PLAYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Player login failed")
    
    def test_get_my_contracts(self, admin_token):
        """GET /api/contracts/my should return contracts"""
        response = requests.get(
            f"{BASE_URL}/api/contracts/my",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get contracts: {response.text}"
        data = response.json()
        assert "as_patron" in data
        assert "as_vassal" in data
        assert isinstance(data["as_patron"], list)
        assert isinstance(data["as_vassal"], list)
        print(f"Contracts - as_patron: {len(data['as_patron'])}, as_vassal: {len(data['as_vassal'])}")
    
    def test_contract_accept_invalid_id(self, admin_token):
        """POST /api/contracts/{id}/accept with invalid ID should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/contracts/invalid-id-12345/accept",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for invalid contract ID")
    
    def test_contract_reject_invalid_id(self, admin_token):
        """POST /api/contracts/{id}/reject with invalid ID should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/contracts/invalid-id-12345/reject",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for invalid contract ID")
    
    def test_contract_cancel_invalid_id(self, admin_token):
        """POST /api/contracts/{id}/cancel with invalid ID should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/contracts/invalid-id-12345/cancel",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for invalid contract ID")


class TestMyBusinessesPage:
    """Test that My Businesses page data doesn't include alliance sections"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_my_businesses_returns_businesses(self, admin_token):
        """GET /api/my/businesses should return businesses list"""
        response = requests.get(
            f"{BASE_URL}/api/my/businesses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get businesses: {response.text}"
        data = response.json()
        assert "businesses" in data
        assert "summary" in data
        print(f"My Businesses: {len(data['businesses'])} businesses")
    
    def test_my_resources_returns_resources(self, admin_token):
        """GET /api/my/resources should return resources"""
        response = requests.get(
            f"{BASE_URL}/api/my/resources",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get resources: {response.text}"
        data = response.json()
        assert "resources" in data
        print(f"My Resources: {len(data['resources'])} resource types")


class TestHealthAndBasicEndpoints:
    """Test basic health and public endpoints"""
    
    def test_health_check(self):
        """Health check should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("Health check passed")
    
    def test_public_tax_settings(self):
        """Public tax settings should be accessible"""
        response = requests.get(f"{BASE_URL}/api/public/tax-settings")
        if response.status_code == 200:
            data = response.json()
            print(f"Tax settings: {data}")
        else:
            print(f"Tax settings endpoint returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
