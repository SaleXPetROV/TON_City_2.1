#!/usr/bin/env python3
"""
Backend API Testing for TON City Builder Tutorial Feature
=========================================================
Tests all tutorial endpoints and integration with the tutorial guard middleware.
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Use the public endpoint from frontend .env
BASE_URL = "https://ton-builder.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDS = {
    "email": "sanyanazarov212@gmail.com",
    "password": "Qetuyrwioo"
}

REGULAR_CREDS = {
    "email": "player@toncity.com", 
    "password": "Player@2024"
}

class TutorialAPITester:
    def __init__(self):
        self.admin_token = None
        self.regular_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, test_func) -> bool:
        """Run a single test and track results"""
        self.tests_run += 1
        self.log(f"🔍 Running test: {name}")
        
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                self.log(f"✅ PASSED: {name}")
                return True
            else:
                self.failed_tests.append(name)
                self.log(f"❌ FAILED: {name}", "ERROR")
                return False
        except Exception as e:
            self.failed_tests.append(f"{name} - Exception: {str(e)}")
            self.log(f"❌ FAILED: {name} - Exception: {str(e)}", "ERROR")
            return False

    def make_request(self, method: str, endpoint: str, token: Optional[str] = None, 
                    data: Optional[Dict] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response data"""
        url = f"{API_BASE}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
            
            if not success:
                self.log(f"Request failed: {method} {endpoint} - Expected {expected_status}, got {response.status_code}")
                self.log(f"Response: {response_data}")
            
            return success, response_data
            
        except Exception as e:
            self.log(f"Request exception: {method} {endpoint} - {str(e)}")
            return False, {"error": str(e)}

    def test_admin_login(self) -> bool:
        """Test admin login and store token"""
        success, data = self.make_request('POST', '/auth/login', data=ADMIN_CREDS)
        if success and 'token' in data:
            self.admin_token = data['token']
            self.log(f"Admin login successful, token obtained")
            return True
        return False

    def test_regular_login(self) -> bool:
        """Test regular user login and store token"""
        success, data = self.make_request('POST', '/auth/login', data=REGULAR_CREDS)
        if success and 'token' in data:
            self.regular_token = data['token']
            self.log(f"Regular user login successful, token obtained")
            return True
        return False

    def test_tutorial_status_initial(self) -> bool:
        """Test GET /api/tutorial/status - should return total_steps=13, step_ids list"""
        # First reset to ensure clean state
        self.make_request('POST', '/tutorial/reset', token=self.admin_token)
        
        success, data = self.make_request('GET', '/tutorial/status', token=self.admin_token)
        if not success:
            return False
        
        # Check required fields
        required_checks = [
            ('total_steps', 13),
            ('active', False),  # Should be false after reset
            ('step_ids', list),
        ]
        
        for field, expected in required_checks:
            if field not in data:
                self.log(f"Missing field: {field}")
                return False
            if isinstance(expected, type):
                if not isinstance(data[field], expected):
                    self.log(f"Field {field} should be {expected.__name__}, got {type(data[field]).__name__}")
                    return False
            else:
                if data[field] != expected:
                    self.log(f"Field {field} should be {expected}, got {data[field]}")
                    return False
        
        # Check step_ids length
        if len(data['step_ids']) != 13:
            self.log(f"step_ids should have 13 items, got {len(data['step_ids'])}")
            return False
            
        return True

    def test_tutorial_reset(self) -> bool:
        """Test POST /api/tutorial/reset - should return ok:true"""
        success, data = self.make_request('POST', '/tutorial/reset', token=self.admin_token)
        return success and data.get('ok') is True

    def test_tutorial_start(self) -> bool:
        """Test POST /api/tutorial/start - should set active=true, current_step_id=welcome"""
        success, data = self.make_request('POST', '/tutorial/start', token=self.admin_token)
        if not success:
            return False
        
        if not data.get('ok'):
            self.log(f"Start response should have ok=true, got {data.get('ok')}")
            return False
        
        if data.get('current_step_id') != 'welcome':
            self.log(f"Start should set current_step_id to 'welcome', got {data.get('current_step_id')}")
            return False
            
        return True

    def test_tutorial_guard_blocking(self) -> bool:
        """Test tutorial guard - calling non-allowed endpoint should return 403"""
        # Try to access market listings while on welcome step (should be blocked)
        success, data = self.make_request('GET', '/market/listings', token=self.admin_token, expected_status=403)
        if not success:
            return False
        
        if data.get('detail') != 'tutorial_action_blocked':
            self.log(f"Expected tutorial_action_blocked, got {data.get('detail')}")
            return False
            
        return True

    def test_tutorial_advance_flow(self) -> bool:
        """Test the full tutorial advance flow through multiple steps"""
        steps_to_test = [
            ('welcome', 'go_dashboard'),
            ('go_dashboard', 'go_island'),
            ('go_island', 'fake_buy_plot'),
        ]
        
        for current_step, expected_next in steps_to_test:
            success, data = self.make_request('POST', '/tutorial/advance', 
                                            token=self.admin_token, 
                                            data={'step_id': current_step})
            if not success:
                self.log(f"Failed to advance from {current_step}")
                return False
            
            if data.get('current_step_id') != expected_next:
                self.log(f"Expected next step {expected_next}, got {data.get('current_step_id')}")
                return False
                
        return True

    def test_fake_buy_plot(self) -> bool:
        """Test POST /api/tutorial/fake-buy-plot"""
        plot_data = {'x': 5, 'y': 5, 'zone': 'outskirts'}
        success, data = self.make_request('POST', '/tutorial/fake-buy-plot', 
                                        token=self.admin_token, 
                                        data=plot_data)
        if not success:
            return False
        
        if not data.get('ok'):
            return False
        
        # Should auto-advance to go_businesses
        if data.get('current_step_id') != 'go_businesses':
            self.log(f"fake-buy-plot should auto-advance to go_businesses, got {data.get('current_step_id')}")
            return False
            
        return True

    def test_advance_to_fake_add_resources(self) -> bool:
        """Advance to fake_add_resources step"""
        success, data = self.make_request('POST', '/tutorial/advance', 
                                        token=self.admin_token, 
                                        data={'step_id': 'go_businesses'})
        return success and data.get('current_step_id') == 'fake_add_resources'

    def test_fake_grant_resource(self) -> bool:
        """Test POST /api/tutorial/fake-grant-resource"""
        resource_data = {'resource_type': 'neuro_core', 'amount': 10}
        success, data = self.make_request('POST', '/tutorial/fake-grant-resource', 
                                        token=self.admin_token, 
                                        data=resource_data)
        if not success:
            return False
        
        if not data.get('ok'):
            return False
        
        # Should auto-advance to go_trading_buy
        if data.get('current_step_id') != 'go_trading_buy':
            self.log(f"fake-grant-resource should auto-advance to go_trading_buy, got {data.get('current_step_id')}")
            return False
            
        return True

    def test_advance_through_trading_steps(self) -> bool:
        """Advance through trading steps to reach create_lot"""
        steps = ['go_trading_buy', 'go_trading_my']
        
        for step in steps:
            success, data = self.make_request('POST', '/tutorial/advance', 
                                            token=self.admin_token, 
                                            data={'step_id': step})
            if not success:
                self.log(f"Failed to advance from {step}")
                return False
                
        return True

    def test_create_lot_gate_failure(self) -> bool:
        """Test that advancing create_lot fails before creating a lot"""
        success, data = self.make_request('POST', '/tutorial/advance', 
                                        token=self.admin_token, 
                                        data={'step_id': 'create_lot'},
                                        expected_status=400)
        if not success:
            return False
        
        if 'tutorial_gate_failed' not in data.get('detail', ''):
            self.log(f"Expected tutorial_gate_failed error, got {data.get('detail')}")
            return False
            
        return True

    def test_create_tutorial_lot(self) -> bool:
        """Test POST /api/tutorial/create-lot"""
        lot_data = {'resource_type': 'neuro_core', 'amount': 5, 'price_per_unit': 1.5}
        success, data = self.make_request('POST', '/tutorial/create-lot', 
                                        token=self.admin_token, 
                                        data=lot_data)
        if not success:
            return False
        
        if not data.get('ok'):
            return False
        
        # Should auto-advance to go_credit
        if data.get('current_step_id') != 'go_credit':
            self.log(f"create-lot should auto-advance to go_credit, got {data.get('current_step_id')}")
            return False
            
        return True

    def test_hidden_lot_visibility(self) -> bool:
        """Test that tutorial lots are hidden from public listings"""
        # First finish the tutorial to allow access to market listings
        self.make_request('POST', '/tutorial/finish', token=self.admin_token)
        
        # Check with admin token - should not see tutorial lots
        success, data = self.make_request('GET', '/market/listings', token=self.admin_token)
        if not success:
            return False
        
        # Check that no tutorial lots are visible
        listings = data.get('listings', [])
        for listing in listings:
            if listing.get('tutorial'):
                self.log(f"Found tutorial lot in public listings: {listing}")
                return False
        
        # Check with regular user token
        success, data = self.make_request('GET', '/market/listings', token=self.regular_token)
        if not success:
            return False
        
        listings = data.get('listings', [])
        for listing in listings:
            if listing.get('tutorial'):
                self.log(f"Regular user can see tutorial lot: {listing}")
                return False
                
        return True

    def test_advance_to_finish(self) -> bool:
        """Advance through remaining steps to finish"""
        remaining_steps = ['go_credit', 'go_leaderboard', 'go_security']
        
        for step in remaining_steps:
            success, data = self.make_request('POST', '/tutorial/advance', 
                                            token=self.admin_token, 
                                            data={'step_id': step})
            if not success:
                self.log(f"Failed to advance from {step}")
                return False
                
        return True

    def test_tutorial_skip_optional(self) -> bool:
        """Test /api/tutorial/skip on optional step (go_security)"""
        # First, reset and advance to go_security step
        self.make_request('POST', '/tutorial/reset', token=self.admin_token)
        self.make_request('POST', '/tutorial/start', token=self.admin_token)
        
        # Advance to go_security (step 11)
        steps = ['welcome', 'go_dashboard', 'go_island']
        for step in steps:
            self.make_request('POST', '/tutorial/advance', token=self.admin_token, data={'step_id': step})
        
        # Fake buy plot and advance
        self.make_request('POST', '/tutorial/fake-buy-plot', token=self.admin_token, data={'x': 5, 'y': 5})
        self.make_request('POST', '/tutorial/advance', token=self.admin_token, data={'step_id': 'go_businesses'})
        self.make_request('POST', '/tutorial/fake-grant-resource', token=self.admin_token, data={'resource_type': 'neuro_core', 'amount': 10})
        
        # Advance through trading
        trading_steps = ['go_trading_buy', 'go_trading_my']
        for step in trading_steps:
            self.make_request('POST', '/tutorial/advance', token=self.admin_token, data={'step_id': step})
        
        # Create lot and advance
        self.make_request('POST', '/tutorial/create-lot', token=self.admin_token, data={'resource_type': 'neuro_core', 'amount': 5, 'price_per_unit': 1.5})
        
        # Advance to go_security
        advance_steps = ['go_credit', 'go_leaderboard']
        for step in advance_steps:
            self.make_request('POST', '/tutorial/advance', token=self.admin_token, data={'step_id': step})
        
        # Now test skip on go_security (optional step)
        success, data = self.make_request('POST', '/tutorial/skip', 
                                        token=self.admin_token, 
                                        data={'step_id': 'go_security'})
        if not success:
            return False
        
        if data.get('current_step_id') != 'finish':
            self.log(f"Skip go_security should advance to finish, got {data.get('current_step_id')}")
            return False
            
        return True

    def test_tutorial_finish(self) -> bool:
        """Test POST /api/tutorial/finish - atomic rollback"""
        success, data = self.make_request('POST', '/tutorial/finish', token=self.admin_token)
        if not success:
            return False
        
        if not data.get('ok'):
            return False
        
        # Verify tutorial is no longer active
        success, status_data = self.make_request('GET', '/tutorial/status', token=self.admin_token)
        if not success:
            return False
        
        if status_data.get('active') is not False:
            self.log(f"Tutorial should be inactive after finish, got active={status_data.get('active')}")
            return False
        
        if status_data.get('completed') is not True:
            self.log(f"Tutorial should be completed after finish, got completed={status_data.get('completed')}")
            return False
            
        return True

    def run_all_tests(self):
        """Run all tutorial tests in sequence"""
        self.log("🚀 Starting Tutorial API Tests")
        self.log(f"Testing against: {BASE_URL}")
        
        # Authentication tests
        self.run_test("Admin Login", self.test_admin_login)
        self.run_test("Regular User Login", self.test_regular_login)
        
        if not self.admin_token:
            self.log("❌ Cannot continue without admin token", "ERROR")
            return
        
        # Tutorial flow tests
        self.run_test("Tutorial Reset", self.test_tutorial_reset)
        self.run_test("Tutorial Status Initial", self.test_tutorial_status_initial)
        self.run_test("Tutorial Start", self.test_tutorial_start)
        self.run_test("Tutorial Guard Blocking", self.test_tutorial_guard_blocking)
        self.run_test("Tutorial Advance Flow", self.test_tutorial_advance_flow)
        self.run_test("Fake Buy Plot", self.test_fake_buy_plot)
        self.run_test("Advance to Fake Add Resources", self.test_advance_to_fake_add_resources)
        self.run_test("Fake Grant Resource", self.test_fake_grant_resource)
        self.run_test("Advance Through Trading Steps", self.test_advance_through_trading_steps)
        self.run_test("Create Lot Gate Failure", self.test_create_lot_gate_failure)
        self.run_test("Create Tutorial Lot", self.test_create_tutorial_lot)
        self.run_test("Hidden Lot Visibility", self.test_hidden_lot_visibility)
        self.run_test("Advance to Finish", self.test_advance_to_finish)
        self.run_test("Tutorial Skip Optional", self.test_tutorial_skip_optional)
        self.run_test("Tutorial Finish", self.test_tutorial_finish)
        
        # Print summary
        self.log("=" * 60)
        self.log(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            self.log("❌ Failed tests:")
            for test in self.failed_tests:
                self.log(f"  - {test}")
        else:
            self.log("✅ All tests passed!")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TutorialAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())