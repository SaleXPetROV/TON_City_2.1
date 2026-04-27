"""Backend auth tests for TON City - testing login for admin and regular user"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthLogin:
    """Authentication login endpoint tests"""

    def test_admin_login_success(self):
        """Admin login should return token with is_admin: true"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sanyanazarov212@gmail.com",
            "password": "Qetuyrwioo"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data, f"No token in response: {data}"
        assert "user" in data, f"No user in response: {data}"
        assert data["user"].get("is_admin") == True, f"Expected is_admin=True, got: {data['user']}"
        print(f"Admin login OK: {data['user'].get('is_admin')} {data['user'].get('username', '')}")

    def test_regular_user_login_success(self):
        """Regular user login should return token with is_admin: false"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "player@toncity.com",
            "password": "Player@2024"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data, f"No token in response: {data}"
        assert "user" in data, f"No user in response: {data}"
        assert data["user"].get("is_admin") == False, f"Expected is_admin=False, got: {data['user']}"
        print(f"Regular user login OK: {data['user'].get('is_admin')} {data['user'].get('username', '')}")

    def test_invalid_credentials(self):
        """Invalid login should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400, 404], f"Expected error status, got {response.status_code}: {response.text}"
        print(f"Invalid credentials returns {response.status_code} - OK")

    def test_health_check(self):
        """Backend health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print(f"Health check OK")
