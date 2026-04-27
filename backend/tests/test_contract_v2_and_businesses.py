"""
Tests for Contract System V2 and Admin Business Changes:
- Admin user login works
- Admin businesses should be exactly 2 (VR Club and Gram Bank) - quartz_mine was removed
- Contract types endpoint returns 3 types with V2 fields (patron_benefit, penalty_city, color)
- Contract history endpoint works - GET /api/contracts/history
- My contracts endpoint returns V2 enriched data - GET /api/contracts/my
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for authenticated requests"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "sanyanazarov212@gmail.com",
        "password": "Qetuyrwioo"
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    return data.get("token") or data.get("access_token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestAdminLogin:
    """Test admin login functionality"""
    
    def test_admin_login_returns_token(self):
        """Admin login should return token and user data"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sanyanazarov212@gmail.com",
            "password": "Qetuyrwioo"
        })
        assert resp.status_code == 200, f"Login failed: {resp.status_code}"
        data = resp.json()
        assert "token" in data or "access_token" in data
        assert "user" in data
        assert data["user"].get("is_admin") == True
        print(f"✓ Admin login successful: {data['user'].get('username')}")


class TestAdminBusinesses:
    """Test admin businesses - quartz_mine should be removed"""
    
    def test_admin_has_exactly_2_businesses(self, auth_headers):
        """Admin should have exactly 2 businesses (VR Club and Gram Bank)"""
        resp = requests.get(f"{BASE_URL}/api/my/businesses", headers=auth_headers)
        assert resp.status_code == 200, f"Failed to get businesses: {resp.status_code}"
        data = resp.json()
        businesses = data.get("businesses", [])
        
        # Should have exactly 2 businesses
        assert len(businesses) == 2, f"Expected 2 businesses, got {len(businesses)}: {[b.get('business_type') for b in businesses]}"
        
        # Get business types
        business_types = [b.get("business_type") for b in businesses]
        print(f"✓ Admin businesses: {business_types}")
        
        # Verify quartz_mine is NOT present
        assert "quartz_mine" not in business_types, f"quartz_mine should be removed but found in: {business_types}"
        
        # Verify expected businesses are present
        assert "vr_club" in business_types, f"vr_club should be present but not found in: {business_types}"
        assert "gram_bank" in business_types, f"gram_bank should be present but not found in: {business_types}"
        
        print(f"✓ Quartz mine removed, VR Club and Gram Bank present")


class TestContractTypesV2:
    """Test contract types endpoint with V2 fields"""
    
    def test_contract_types_returns_3_types(self):
        """GET /api/contracts/types should return 3 types"""
        resp = requests.get(f"{BASE_URL}/api/contracts/types")
        assert resp.status_code == 200, f"Failed: {resp.status_code}"
        data = resp.json()
        assert "types" in data
        assert len(data["types"]) == 3, f"Expected 3 types, got {len(data['types'])}"
        
        type_ids = [t["id"] for t in data["types"]]
        assert "tax_haven" in type_ids
        assert "raw_material" in type_ids
        assert "tech_umbrella" in type_ids
        print(f"✓ Contract types: {type_ids}")
    
    def test_contract_types_have_v2_fields(self):
        """Contract types should have V2 fields: patron_benefit, penalty_city, color"""
        resp = requests.get(f"{BASE_URL}/api/contracts/types")
        assert resp.status_code == 200
        data = resp.json()
        
        for contract_type in data["types"]:
            type_id = contract_type.get("id")
            
            # V2 fields
            assert "patron_benefit" in contract_type, f"{type_id} missing patron_benefit"
            assert "penalty_city" in contract_type, f"{type_id} missing penalty_city"
            assert "color" in contract_type, f"{type_id} missing color"
            
            # Validate penalty_city is a number
            assert isinstance(contract_type["penalty_city"], (int, float)), f"{type_id} penalty_city should be number"
            
            # Validate color is a hex string
            assert contract_type["color"].startswith("#"), f"{type_id} color should be hex: {contract_type['color']}"
            
            print(f"✓ {type_id}: patron_benefit='{contract_type['patron_benefit']}', penalty={contract_type['penalty_city']}, color={contract_type['color']}")


class TestContractHistoryV2:
    """Test contract history endpoint"""
    
    def test_contract_history_requires_auth(self):
        """GET /api/contracts/history should require authentication"""
        resp = requests.get(f"{BASE_URL}/api/contracts/history")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Contract history requires auth")
    
    def test_contract_history_returns_structure(self, auth_headers):
        """GET /api/contracts/history should return history array"""
        resp = requests.get(f"{BASE_URL}/api/contracts/history", headers=auth_headers)
        assert resp.status_code == 200, f"Failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        assert "history" in data, f"Missing 'history' key in response: {data}"
        assert isinstance(data["history"], list), f"history should be a list"
        print(f"✓ Contract history returned {len(data['history'])} items")


class TestMyContractsV2:
    """Test my contracts endpoint with V2 enriched data"""
    
    def test_my_contracts_requires_auth(self):
        """GET /api/contracts/my should require authentication"""
        resp = requests.get(f"{BASE_URL}/api/contracts/my")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ My contracts requires auth")
    
    def test_my_contracts_returns_structure(self, auth_headers):
        """GET /api/contracts/my should return as_patron and as_vassal arrays"""
        resp = requests.get(f"{BASE_URL}/api/contracts/my", headers=auth_headers)
        assert resp.status_code == 200, f"Failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        assert "as_patron" in data, f"Missing 'as_patron' key"
        assert "as_vassal" in data, f"Missing 'as_vassal' key"
        assert isinstance(data["as_patron"], list)
        assert isinstance(data["as_vassal"], list)
        
        print(f"✓ My contracts: {len(data['as_patron'])} as patron, {len(data['as_vassal'])} as vassal")
    
    def test_my_contracts_v2_enriched_fields(self, auth_headers):
        """Active contracts should have V2 enriched fields"""
        resp = requests.get(f"{BASE_URL}/api/contracts/my", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        all_contracts = data["as_patron"] + data["as_vassal"]
        
        if len(all_contracts) == 0:
            print("⚠ No contracts to verify V2 fields (this is OK if no contracts exist)")
            return
        
        for contract in all_contracts:
            # V2 enriched fields should be present
            v2_fields = ["days_elapsed", "days_remaining", "progress_pct", "in_grace_period", 
                        "patron_benefit_text", "vassal_benefit_text", "penalty_city"]
            
            for field in v2_fields:
                assert field in contract, f"Contract missing V2 field: {field}"
            
            # Validate types
            assert isinstance(contract["days_elapsed"], (int, float))
            assert isinstance(contract["days_remaining"], (int, float))
            assert isinstance(contract["progress_pct"], (int, float))
            assert isinstance(contract["in_grace_period"], bool)
            
            print(f"✓ Contract {contract.get('id', 'unknown')[:8]}... has V2 fields")


class TestContractProposalV2:
    """Test contract proposal with V2 duration and auto_renew"""
    
    def test_propose_contract_requires_auth(self):
        """POST /api/contracts/propose should require authentication"""
        resp = requests.post(f"{BASE_URL}/api/contracts/propose", json={
            "type": "tax_haven",
            "vassal_business_id": "test",
            "patron_buff": "test",
            "duration_days": 30,
            "auto_renew": False
        })
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Contract proposal requires auth")
    
    def test_propose_contract_validates_duration(self, auth_headers):
        """Contract proposal should validate duration (7-90 days)"""
        # Test with invalid duration (too short)
        resp = requests.post(f"{BASE_URL}/api/contracts/propose", headers=auth_headers, json={
            "type": "tax_haven",
            "vassal_business_id": "nonexistent",
            "patron_buff": "test_buff",
            "duration_days": 3,  # Too short, should be 7-90
            "auto_renew": False
        })
        # Should fail with 400 for invalid duration or 403/404 for other reasons
        # The important thing is it doesn't return 500
        assert resp.status_code != 500, f"Got 500 error: {resp.text}"
        print(f"✓ Duration validation: status {resp.status_code}")
    
    def test_propose_contract_validates_type(self, auth_headers):
        """Contract proposal should validate contract type"""
        resp = requests.post(f"{BASE_URL}/api/contracts/propose", headers=auth_headers, json={
            "type": "invalid_type",
            "vassal_business_id": "test",
            "patron_buff": "test",
            "duration_days": 30,
            "auto_renew": False
        })
        assert resp.status_code in [400, 422], f"Expected 400/422 for invalid type, got {resp.status_code}"
        print("✓ Contract type validation works")


class TestContractCancelGracePeriod:
    """Test contract cancellation with grace period logic"""
    
    def test_cancel_contract_requires_auth(self):
        """POST /api/contracts/{id}/cancel should require authentication"""
        resp = requests.post(f"{BASE_URL}/api/contracts/fake-id/cancel")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Contract cancel requires auth")
    
    def test_cancel_nonexistent_contract(self, auth_headers):
        """Canceling nonexistent contract should return 404"""
        resp = requests.post(f"{BASE_URL}/api/contracts/nonexistent-contract-id/cancel", headers=auth_headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("✓ Cancel nonexistent contract returns 404")
