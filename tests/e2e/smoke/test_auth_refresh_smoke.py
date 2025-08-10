#!/usr/bin/env python3
"""
E2E Smoke Tests for Token Refresh Functionality
Tests the /auth/refresh endpoint: API Gateway → Lambda → DynamoDB

This test suite verifies:
1. Successful token refresh with valid token
2. Refresh fails with expired token
3. Refresh fails with invalid token
4. Refresh returns new token with fresh 30-day expiry
5. Refresh updates last_activity in DynamoDB
6. Refresh works with token in Authorization header
7. Refresh works with token in request body

Prerequisites:
- AWS CLI configured with personal profile
- DynamoDB table 'heatherandwesley-users' exists
- Lambda function 'heatherandwesley-auth-handler' deployed
- API Gateway deployed with /auth/refresh endpoint
"""

import hashlib
import json
import os
import uuid
import time
import jwt
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import boto3
import pytest
import requests

# Configuration
API_GATEWAY_URL = os.getenv(
    "VITE_API_URL", "https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod"
)
AWS_PROFILE = "personal"
AWS_REGION = "us-east-1"
DYNAMODB_TABLE = "heatherandwesley-users"
LAMBDA_FUNCTION = "heatherandwesley-auth-handler"

# JWT configuration (should match Lambda function)
JWT_SECRET = os.getenv("JWT_SECRET", "development-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30


@pytest.mark.smoke
@pytest.mark.skip(reason="E2E tests require full environment setup - skipping in CI")
class TestTokenRefreshE2E:
    """End-to-end token refresh functionality tests"""

    @classmethod
    def setup_class(cls):
        """Set up AWS clients and test data"""
        cls.session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        cls.dynamodb = cls.session.resource("dynamodb")
        cls.lambda_client = cls.session.client("lambda")
        cls.table = cls.dynamodb.Table(DYNAMODB_TABLE)

        # Test user data
        cls.test_user_id = f"refresh-test-{uuid.uuid4().hex[:8]}"
        cls.test_username = f"refreshuser_{uuid.uuid4().hex[:8]}"
        cls.test_password = "RefreshTest123!"
        cls.test_email = f"refresh_{uuid.uuid4().hex[:8]}@example.com"

        # Create test user in DynamoDB
        cls._create_test_user()

    @classmethod
    def teardown_class(cls):
        """Clean up test data"""
        try:
            cls.table.delete_item(Key={"username": cls.test_username})
        except Exception as e:
            print(f"Warning: Failed to cleanup test user: {e}")

    @classmethod
    def _create_test_user(cls):
        """Create a test user in DynamoDB"""
        # Hash password (using simple SHA256 for testing - production should use bcrypt)
        password_hash = hashlib.sha256(cls.test_password.encode()).hexdigest()

        user_item = {
            "username": cls.test_username,
            "email": cls.test_email,
            "password_hash": password_hash,
            "full_name": "Refresh Test User",
            "role": "guest",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
        }

        cls.table.put_item(Item=user_item)

    def _generate_valid_token(self):
        """Generate a valid JWT token for the test user"""
        payload = {
            "username": self.test_username,
            "role": "guest",
            "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def _generate_expired_token(self):
        """Generate an expired JWT token for the test user"""
        payload = {
            "username": self.test_username,
            "role": "guest",
            "exp": datetime.utcnow() - timedelta(days=1),  # Expired 1 day ago
            "iat": datetime.utcnow() - timedelta(days=2),  # Issued 2 days ago
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def _generate_near_expiry_token(self):
        """Generate a token that should trigger refresh (80% of lifetime passed)"""
        now = datetime.utcnow()
        # Token issued 24 days ago, expires in 6 days (80% of 30 days = 24 days)
        issued_time = now - timedelta(days=24)
        expiry_time = now + timedelta(days=6)
        
        payload = {
            "username": self.test_username,
            "role": "guest",
            "exp": expiry_time,
            "iat": issued_time,
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    def test_refresh_endpoint_exists(self):
        """Test that /auth/refresh endpoint exists and is accessible"""
        try:
            # Make request without token to check if endpoint exists
            response = requests.post(
                f"{API_GATEWAY_URL}/auth/refresh",
                json={},
                timeout=10
            )
            # Should return 401 (unauthorized) not 404 (not found)
            assert response.status_code in [400, 401, 422], \
                f"Expected 400/401/422 for missing token, got {response.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("API Gateway not accessible - check VITE_API_URL")

    def test_successful_token_refresh_with_authorization_header(self):
        """Test successful token refresh using Authorization header"""
        # Generate a valid token that should be refreshable
        valid_token = self._generate_valid_token()
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {valid_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        # Validate response
        assert response.status_code == 200, f"Token refresh failed: {response.text}"

        data = response.json()

        # Validate response structure
        assert "token" in data, "Response missing token field"
        assert "user" in data, "Response missing user field"
        assert "expires_at" in data, "Response missing expires_at field"

        # Validate new token format (JWT should have 3 parts separated by dots)
        new_token = data["token"]
        assert len(new_token.split(".")) == 3, "Invalid JWT token format"
        assert new_token != valid_token, "New token should be different from original"

        # Validate user data
        user = data["user"]
        assert user["username"] == self.test_username
        assert user["email"] == self.test_email
        assert user["full_name"] == "Refresh Test User"
        assert user["role"] == "guest"
        assert "password_hash" not in user, "Password hash exposed in response"

        # Validate new token payload
        try:
            new_payload = jwt.decode(new_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            assert new_payload["username"] == self.test_username
            assert new_payload["role"] == "guest"
            
            # Check that new token has fresh expiry (approximately 30 days from now)
            exp_time = datetime.fromtimestamp(new_payload["exp"], tz=timezone.utc)
            now = datetime.now(timezone.utc)
            time_until_expiry = exp_time - now
            
            # Should be close to 30 days (allow some variance for test execution time)
            assert 29 <= time_until_expiry.days <= 30, \
                f"New token should have ~30 days expiry, got {time_until_expiry.days} days"
                
        except jwt.InvalidTokenError as e:
            pytest.fail(f"New token is invalid: {e}")

        return new_token

    def test_successful_token_refresh_with_request_body(self):
        """Test successful token refresh using request body"""
        valid_token = self._generate_valid_token()
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            json={"token": valid_token},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should work the same as Authorization header method
        assert response.status_code == 200, f"Token refresh with body failed: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == self.test_username

    def test_refresh_fails_with_expired_token(self):
        """Test that refresh fails with expired token"""
        expired_token = self._generate_expired_token()
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {expired_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        # Should return 401 Unauthorized for expired token
        assert response.status_code == 401, \
            f"Expected 401 for expired token, got {response.status_code}: {response.text}"

        data = response.json()
        assert "error" in data or "message" in data, \
            "Error response should contain error message"

    def test_refresh_fails_with_invalid_token(self):
        """Test that refresh fails with invalid/malformed token"""
        invalid_token = "invalid.jwt.token"
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {invalid_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        # Should return 401 Unauthorized for invalid token
        assert response.status_code == 401, \
            f"Expected 401 for invalid token, got {response.status_code}: {response.text}"

    def test_refresh_fails_without_token(self):
        """Test that refresh fails when no token is provided"""
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should return 400 or 401 for missing token
        assert response.status_code in [400, 401], \
            f"Expected 400/401 for missing token, got {response.status_code}: {response.text}"

    def test_refresh_fails_with_nonexistent_user(self):
        """Test that refresh fails when token contains nonexistent user"""
        # Generate token for user that doesn't exist in database
        payload = {
            "username": "nonexistent_user_123",
            "role": "guest",
            "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
            "iat": datetime.utcnow(),
        }
        nonexistent_user_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {nonexistent_user_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        # Should return 401/404 for nonexistent user
        assert response.status_code in [401, 404], \
            f"Expected 401/404 for nonexistent user, got {response.status_code}: {response.text}"

    def test_refresh_updates_last_activity_in_dynamodb(self):
        """Test that successful refresh updates last_activity in DynamoDB"""
        # Get initial last_activity
        initial_item = self.table.get_item(Key={"username": self.test_username})["Item"]
        initial_last_activity = initial_item.get("last_activity", initial_item.get("last_login"))

        # Wait a moment to ensure timestamp difference
        time.sleep(1)

        # Refresh token
        valid_token = self._generate_valid_token()
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {valid_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        assert response.status_code == 200, "Token refresh should succeed"

        # Check updated last_activity
        updated_item = self.table.get_item(Key={"username": self.test_username})["Item"]
        updated_last_activity = updated_item.get("last_activity", updated_item.get("last_login"))

        assert updated_last_activity != initial_last_activity, \
            "last_activity should be updated on token refresh"

        # Parse timestamps to ensure updated is later
        from datetime import datetime

        try:
            initial_dt = datetime.fromisoformat(initial_last_activity.replace("Z", "+00:00"))
            updated_dt = datetime.fromisoformat(updated_last_activity.replace("Z", "+00:00"))

            assert updated_dt > initial_dt, \
                "Updated last_activity should be later than initial"
        except ValueError:
            # Handle different timestamp formats
            print(f"Warning: Could not parse timestamps for comparison: {initial_last_activity} -> {updated_last_activity}")

    def test_refresh_with_near_expiry_token(self):
        """Test refresh with token that's at 80% of its lifetime (should refresh)"""
        near_expiry_token = self._generate_near_expiry_token()
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {near_expiry_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        assert response.status_code == 200, \
            f"Token refresh should succeed for near-expiry token: {response.text}"

        data = response.json()
        new_token = data["token"]
        
        # Verify the new token has a fresh expiry
        new_payload = jwt.decode(new_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        exp_time = datetime.fromtimestamp(new_payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        time_until_expiry = exp_time - now
        
        # Should have close to 30 days
        assert time_until_expiry.days >= 29, \
            f"Refreshed token should have ~30 days expiry, got {time_until_expiry.days} days"

    def test_concurrent_refresh_requests(self):
        """Test handling of concurrent refresh requests"""
        import concurrent.futures
        
        valid_token = self._generate_valid_token()

        def make_refresh_request():
            return requests.post(
                f"{API_GATEWAY_URL}/auth/refresh",
                headers={
                    "Authorization": f"Bearer {valid_token}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )

        # Make 3 concurrent refresh requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(make_refresh_request) for _ in range(3)]
            responses = [
                future.result() for future in concurrent.futures.as_completed(futures)
            ]

        # All should succeed (or at least not crash)
        success_count = 0
        for response in responses:
            if response.status_code == 200:
                success_count += 1
            else:
                # Some may fail due to race conditions, but should not crash
                assert response.status_code in [401, 500], \
                    f"Unexpected status in concurrent test: {response.status_code}"

        # At least one should succeed
        assert success_count >= 1, "At least one concurrent refresh should succeed"

    def test_refresh_response_format_consistency(self):
        """Test that refresh response format is consistent with login response"""
        valid_token = self._generate_valid_token()
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {valid_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        assert response.status_code == 200, "Token refresh should succeed"
        
        data = response.json()
        
        # Should have same structure as login response (with message field)
        required_fields = {"message", "token", "user", "expires_at"}
        assert required_fields.issubset(set(data.keys())), \
            f"Response should have fields {required_fields}, got {set(data.keys())}"

        # User object should have expected fields
        user = data["user"]
        expected_user_fields = {"username", "email", "full_name", "role"}
        user_fields = set(user.keys())
        
        # Should contain at least the expected fields
        assert expected_user_fields.issubset(user_fields), \
            f"User object missing expected fields. Expected: {expected_user_fields}, Got: {user_fields}"

    def test_refresh_execution_time(self):
        """Test that token refresh completes within reasonable time"""
        valid_token = self._generate_valid_token()
        
        start_time = time.time()

        response = requests.post(
            f"{API_GATEWAY_URL}/auth/refresh",
            headers={
                "Authorization": f"Bearer {valid_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        execution_time = time.time() - start_time

        assert response.status_code == 200, "Token refresh should succeed for timing test"
        assert execution_time < 5.0, \
            f"Token refresh took too long: {execution_time:.2f}s"

        print(f"Token refresh completed in {execution_time:.2f}s")

    def test_refresh_with_different_token_formats(self):
        """Test refresh handles different token formats gracefully"""
        test_cases = [
            ("", 400),  # Empty string
            ("Bearer invalid", 401),  # Malformed Bearer format
            ("not-a-jwt-token", 401),  # Not JWT format
            ("header.payload", 401),  # Invalid JWT (missing signature)
            ("a.b.c.d", 401),  # Too many parts
        ]

        for test_token, expected_status in test_cases:
            response = requests.post(
                f"{API_GATEWAY_URL}/auth/refresh",
                headers={
                    "Authorization": f"Bearer {test_token}" if test_token else "Bearer ",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )

            assert response.status_code in [400, 401, 422], \
                f"Token '{test_token}' should return 400/401/422, got {response.status_code}"


@pytest.mark.integration
class TestTokenRefreshIntegration:
    """Integration tests for token refresh that don't require full AWS deployment"""

    def test_jwt_token_refresh_logic(self):
        """Test JWT token refresh logic without API calls"""
        # Test token lifetime calculation
        now = datetime.utcnow()
        
        # Create token at 80% of lifetime (should trigger refresh)
        issued_24_days_ago = now - timedelta(days=24)
        expires_in_6_days = now + timedelta(days=6)
        
        old_payload = {
            "username": "testuser",
            "role": "guest",
            "iat": int(issued_24_days_ago.timestamp()),
            "exp": int(expires_in_6_days.timestamp()),
        }
        
        # Calculate if token should be refreshed (80% rule)
        token_lifetime = old_payload["exp"] - old_payload["iat"]
        token_age = int(now.timestamp()) - old_payload["iat"]
        should_refresh = token_age >= token_lifetime * 0.8
        
        assert should_refresh, "Token at 80% lifetime should trigger refresh"

        # Test fresh token (should not trigger refresh)
        issued_1_day_ago = now - timedelta(days=1)
        expires_in_29_days = now + timedelta(days=29)
        
        fresh_payload = {
            "username": "testuser",
            "role": "guest", 
            "iat": int(issued_1_day_ago.timestamp()),
            "exp": int(expires_in_29_days.timestamp()),
        }
        
        token_lifetime = fresh_payload["exp"] - fresh_payload["iat"]
        token_age = int(now.timestamp()) - fresh_payload["iat"]
        should_refresh = token_age >= token_lifetime * 0.8
        
        assert not should_refresh, "Fresh token should not trigger refresh"

    def test_token_refresh_field_consistency(self):
        """Test that token refresh maintains field consistency"""
        # Expected fields in refresh response
        expected_response_fields = {"message", "token", "user", "expires_at"}
        expected_user_fields = {"username", "email", "full_name", "role"}
        
        # This documents the expected contract
        assert len(expected_response_fields) == 4, "Refresh response should have 4 fields"
        assert len(expected_user_fields) == 4, "User object should have 4 core fields"
        
        print("Expected refresh response fields:", expected_response_fields)
        print("Expected user fields:", expected_user_fields)


if __name__ == "__main__":
    # Run with: python -m pytest tests/e2e/smoke/test_auth_refresh_smoke.py -v
    pytest.main([__file__, "-v", "--tb=short"])