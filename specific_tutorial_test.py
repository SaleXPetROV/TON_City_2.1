#!/usr/bin/env python3
"""
TON City Builder Tutorial Backend API Tests - Specific Requirements
==================================================================
Tests the exact sequence mentioned in the review request.
"""

import requests
import sys
import json
from datetime import datetime

class SpecificTutorialTester:
    def __init__(self, base_url="https://ton-urban-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if not success:
                self.log(f"❌ {method} {endpoint} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response_data}")
            else:
                self.log(f"✅ {method} {endpoint} - Status {response.status_code}")

            return success, response_data

        except Exception as e:
            self.log(f"❌ {method} {endpoint} - Exception: {str(e)}")
            return False, {"error": str(e)}

    def test_sequence(self):
        """Test the exact sequence from requirements"""
        self.log("🚀 Testing specific tutorial API sequence from requirements")
        
        # 1. Login
        self.log("\n1. POST /api/auth/login → token")
        success, data = self.make_request('POST', 'auth/login', {
            "email": "sanyanazarov212@gmail.com",
            "password": "Qetuyrwioo"
        })
        if not success or 'token' not in data:
            self.log("❌ Login failed")
            return False
        
        self.token = data['token']
        self.log(f"   Token obtained: {self.token[:20]}...")

        # 2. Reset tutorial
        self.log("\n2. POST /api/tutorial/reset → ok")
        success, data = self.make_request('POST', 'tutorial/reset')
        if not success or not data.get('ok'):
            self.log("❌ Reset failed")
            return False

        # 3. Check status (should be inactive, not completed)
        self.log("\n3. GET /api/tutorial/status → {active:false, completed:false}")
        success, data = self.make_request('GET', 'tutorial/status')
        if not success:
            return False
        
        if data.get('active') != False or data.get('completed') != False:
            self.log(f"❌ Expected active=false, completed=false. Got active={data.get('active')}, completed={data.get('completed')}")
            return False
        self.log("   ✅ Status correct: active=false, completed=false")

        # 4. Mark as skipped
        self.log("\n4. POST /api/tutorial/mark-skipped → ok + marked_skipped=true")
        success, data = self.make_request('POST', 'tutorial/mark-skipped')
        if not success or not data.get('ok') or not data.get('marked_skipped'):
            self.log(f"❌ Mark skipped failed. Response: {data}")
            return False
        self.log("   ✅ Marked as skipped successfully")

        # 5. Check status after skipping (should be completed=true)
        self.log("\n5. GET /api/tutorial/status → {active:false, completed:true}")
        success, data = self.make_request('GET', 'tutorial/status')
        if not success:
            return False
        
        if data.get('active') != False or data.get('completed') != True:
            self.log(f"❌ Expected active=false, completed=true. Got active={data.get('active')}, completed={data.get('completed')}")
            return False
        self.log("   ✅ Status correct after skip: active=false, completed=true")

        # 6. Start tutorial after mark-skipped (should clear prior completion flag)
        self.log("\n6. POST /api/tutorial/start after mark-skipped → ok, active=true, completed=false")
        success, data = self.make_request('POST', 'tutorial/start')
        if not success or not data.get('ok'):
            self.log(f"❌ Start after skip failed. Response: {data}")
            return False
        self.log("   ✅ Tutorial started after skip")

        # Verify status after restart
        success, status_data = self.make_request('GET', 'tutorial/status')
        if not success:
            return False
        
        if status_data.get('active') != True or status_data.get('completed') != False:
            self.log(f"❌ Expected active=true, completed=false after restart. Got active={status_data.get('active')}, completed={status_data.get('completed')}")
            return False
        self.log("   ✅ Status correct after restart: active=true, completed=false")

        # 7. Finish tutorial
        self.log("\n7. POST /api/tutorial/finish → ok, rolled_back=true; status returns completed=true")
        success, data = self.make_request('POST', 'tutorial/finish')
        if not success or not data.get('ok'):
            self.log(f"❌ Finish failed. Response: {data}")
            return False
        
        if not data.get('rolled_back'):
            self.log(f"❌ Expected rolled_back=true. Got: {data}")
            return False
        self.log("   ✅ Tutorial finished with rollback")

        # Verify final status
        success, status_data = self.make_request('GET', 'tutorial/status')
        if not success:
            return False
        
        if status_data.get('active') != False or status_data.get('completed') != True:
            self.log(f"❌ Expected active=false, completed=true after finish. Got active={status_data.get('active')}, completed={status_data.get('completed')}")
            return False
        self.log("   ✅ Final status correct: active=false, completed=true")

        # 8. Test that previously working endpoints still work
        self.log("\n8. Testing that other endpoints still work")
        endpoints_to_test = [
            ('GET', 'auth/me', 'User profile'),
            ('GET', 'config', 'Config'),
            ('GET', 'health', 'Health check'),
        ]

        for method, endpoint, name in endpoints_to_test:
            success, data = self.make_request(method, endpoint)
            if not success:
                self.log(f"❌ {name} endpoint failed")
                return False
            self.log(f"   ✅ {name} endpoint working")

        self.log("\n🎉 All specific requirements tests passed!")
        return True

def main():
    tester = SpecificTutorialTester()
    success = tester.test_sequence()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())