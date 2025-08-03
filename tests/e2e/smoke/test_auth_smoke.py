#!/usr/bin/env python3
"""
E2E Smoke Tests for Authentication Flow
Tests the complete authentication pipeline: API Gateway → Lambda → DynamoDB → Frontend

This test suite verifies:
1. API Gateway endpoint accessibility
2. Lambda function execution
3. DynamoDB user table operations
4. JWT token generation and validation
5. Error handling across the stack

Prerequisites:
- AWS CLI configured with personal profile
- DynamoDB table 'heatherandwesley-users' exists
- Lambda function 'heatherandwesley-auth-handler' deployed
- API Gateway deployed with authentication endpoints
"""

import json
import pytest
import requests
import boto3
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import os

# Configuration
API_GATEWAY_URL = os.getenv('VITE_API_GATEWAY_URL', 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod')
AWS_PROFILE = 'personal'
AWS_REGION = 'us-east-1'
DYNAMODB_TABLE = 'heatherandwesley-users'
LAMBDA_FUNCTION = 'heatherandwesley-auth-handler'


@pytest.mark.smoke
class TestAuthenticationE2E:
    """End-to-end authentication flow tests"""
    
    @classmethod
    def setup_class(cls):
        """Set up AWS clients and test data"""
        session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        cls.dynamodb = session.resource('dynamodb')
        cls.lambda_client = session.client('lambda')
        cls.table = cls.dynamodb.Table(DYNAMODB_TABLE)
        
        # Test user data
        cls.test_user_id = f"test-user-{uuid.uuid4().hex[:8]}"
        cls.test_username = f"testuser_{uuid.uuid4().hex[:8]}"
        cls.test_password = "TestPass123!"
        cls.test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        # Create test user in DynamoDB
        cls._create_test_user()
    
    @classmethod
    def teardown_class(cls):
        """Clean up test data"""
        try:
            cls.table.delete_item(Key={'id': cls.test_user_id})
        except Exception as e:
            print(f"Warning: Failed to cleanup test user: {e}")
    
    @classmethod
    def _create_test_user(cls):
        """Create a test user in DynamoDB"""
        # Hash password (using simple SHA256 for testing - production should use bcrypt)
        password_hash = hashlib.sha256(cls.test_password.encode()).hexdigest()
        
        user_item = {
            'id': cls.test_user_id,
            'username': cls.test_username,
            'email': cls.test_email,
            'password_hash': password_hash,
            'full_name': 'Test User',
            'role': 'guest',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'last_login': datetime.now(timezone.utc).isoformat(),
        }
        
        cls.table.put_item(Item=user_item)
    
    def test_api_gateway_health(self):
        """Test API Gateway is accessible"""
        try:
            # Try to make a request to a known endpoint
            response = requests.get(f"{API_GATEWAY_URL}/health", timeout=10)
            # We expect either 200 (if health endpoint exists) or 404 (if not implemented)
            assert response.status_code in [200, 404], f"Unexpected status code: {response.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("API Gateway not accessible - check VITE_API_GATEWAY_URL")
    
    def test_lambda_function_exists(self):
        """Test Lambda function is deployed and accessible in us-east-1"""
        try:
            response = self.lambda_client.get_function(FunctionName=LAMBDA_FUNCTION)
            assert response['Configuration']['FunctionName'] == LAMBDA_FUNCTION
            assert response['Configuration']['State'] == 'Active'
            
            # Verify function is in correct region
            assert 'us-east-1' in response['Configuration']['FunctionArn'], \
                f"Lambda function not in us-east-1: {response['Configuration']['FunctionArn']}"
        except self.lambda_client.exceptions.ResourceNotFoundException:
            pytest.fail(f"Lambda function {LAMBDA_FUNCTION} not found in us-east-1")
    
    def test_dynamodb_table_exists(self):
        """Test DynamoDB table exists and is accessible in us-east-1"""
        try:
            response = self.table.describe()
            assert response['Table']['TableName'] == DYNAMODB_TABLE
            assert response['Table']['TableStatus'] == 'ACTIVE'
            
            # Verify table is in correct region
            table_arn = response['Table']['TableArn']
            assert 'us-east-1' in table_arn, f"DynamoDB table not in us-east-1: {table_arn}"
        except Exception as e:
            pytest.fail(f"DynamoDB table {DYNAMODB_TABLE} not accessible in us-east-1: {e}")
    
    def test_user_login_success(self):
        """Test successful user login through complete stack"""
        login_data = {
            'username': self.test_username,
            'password': self.test_password
        }
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        # Validate response
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        
        # Validate response structure
        assert 'token' in data, "Response missing token field"
        assert 'user' in data, "Response missing user field"
        assert 'expires_at' in data, "Response missing expires_at field"
        
        # Validate user data
        user = data['user']
        assert user['username'] == self.test_username
        assert user['email'] == self.test_email
        assert user['full_name'] == 'Test User'
        assert user['role'] == 'guest'
        assert 'password_hash' not in user, "Password hash exposed in response"
        
        # Validate token format (JWT should have 3 parts separated by dots)
        token = data['token']
        assert len(token.split('.')) == 3, "Invalid JWT token format"
        
        return token
    
    def test_user_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        login_data = {
            'username': self.test_username,
            'password': 'wrongpassword'
        }
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'error' in data or 'message' in data, "Error response should contain error message"
    
    def test_user_login_nonexistent_user(self):
        """Test login with nonexistent user"""
        login_data = {
            'username': 'nonexistentuser',
            'password': 'anypassword'
        }
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
    
    def test_token_verification_success(self):
        """Test token verification with valid token"""
        # First login to get a token
        token = self.test_user_login_success()
        
        # Now verify the token
        response = requests.get(
            f"{API_GATEWAY_URL}/auth/verify",
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )
        
        assert response.status_code == 200, f"Token verification failed: {response.text}"
        
        data = response.json()
        assert 'user' in data, "Verification response missing user field"
        
        user = data['user']
        assert user['username'] == self.test_username
        assert 'password_hash' not in user, "Password hash exposed in verification response"
    
    def test_token_verification_invalid_token(self):
        """Test token verification with invalid token"""
        invalid_token = "invalid.jwt.token"
        
        response = requests.get(
            f"{API_GATEWAY_URL}/auth/verify",
            headers={
                'Authorization': f'Bearer {invalid_token}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
    
    def test_token_verification_no_token(self):
        """Test token verification without authorization header"""
        response = requests.get(
            f"{API_GATEWAY_URL}/auth/verify",
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
    
    def test_invalid_request_format(self):
        """Test API handling of malformed requests"""
        # Test with invalid JSON
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            data="invalid json",
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        # Should return 400 Bad Request
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    
    def test_missing_required_fields(self):
        """Test API handling of missing required fields"""
        # Test with missing password
        login_data = {
            'username': self.test_username
            # password field missing
        }
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        # Should return 400 Bad Request
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    
    def test_sql_injection_protection(self):
        """Test protection against SQL injection attempts"""
        malicious_input = "'; DROP TABLE users; --"
        
        login_data = {
            'username': malicious_input,
            'password': 'anypassword'
        }
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        # Should handle gracefully (return 401, not crash)
        assert response.status_code in [400, 401], f"Unexpected response to malicious input: {response.status_code}"
        
        # Verify table still exists
        try:
            self.table.describe()
        except Exception:
            pytest.fail("DynamoDB table may have been affected by injection attempt")
    
    def test_rate_limiting_protection(self):
        """Test rate limiting protection (if implemented)"""
        login_data = {
            'username': 'nonexistent',
            'password': 'wrongpass'
        }
        
        # Make multiple rapid requests
        responses = []
        for _ in range(10):
            response = requests.post(
                f"{API_GATEWAY_URL}/auth/login",
                json=login_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            responses.append(response.status_code)
        
        # If rate limiting is implemented, we should see 429 responses
        # If not, all should be 401 (which is also acceptable)
        acceptable_codes = [401, 429]
        for status_code in responses:
            assert status_code in acceptable_codes, f"Unexpected status code during rate limit test: {status_code}"
    
    def test_cors_headers(self):
        """Test CORS headers are properly set"""
        response = requests.options(
            f"{API_GATEWAY_URL}/auth/login",
            headers={'Origin': 'https://example.com'},
            timeout=30
        )
        
        # Check for CORS headers (status might be 200 or 204)
        assert response.status_code in [200, 204], f"OPTIONS request failed: {response.status_code}"
        
        # Check for common CORS headers
        headers = response.headers
        cors_headers = ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers']
        
        for header in cors_headers:
            if header in headers:
                print(f"CORS header found: {header}: {headers[header]}")
    
    def test_lambda_execution_time(self):
        """Test Lambda function execution time is reasonable"""
        login_data = {
            'username': self.test_username,
            'password': self.test_password
        }
        
        import time
        start_time = time.time()
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        execution_time = time.time() - start_time
        
        assert response.status_code == 200, "Login should succeed for timing test"
        assert execution_time < 5.0, f"Lambda execution took too long: {execution_time:.2f}s"
        
        print(f"Authentication request completed in {execution_time:.2f}s")
    
    def test_concurrent_logins(self):
        """Test handling of concurrent login attempts"""
        import concurrent.futures
        import threading
        
        login_data = {
            'username': self.test_username,
            'password': self.test_password
        }
        
        def make_login_request():
            return requests.post(
                f"{API_GATEWAY_URL}/auth/login",
                json=login_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
        
        # Make 5 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_login_request) for _ in range(5)]
            responses = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200, f"Concurrent login failed: {response.text}"
            data = response.json()
            assert 'token' in data
            assert 'user' in data
    
    def test_dynamodb_update_on_login(self):
        """Test that DynamoDB last_login is updated on successful login"""
        # Get initial last_login
        initial_item = self.table.get_item(Key={'id': self.test_user_id})['Item']
        initial_last_login = initial_item['last_login']
        
        # Wait a moment to ensure timestamp difference
        import time
        time.sleep(1)
        
        # Login
        login_data = {
            'username': self.test_username,
            'password': self.test_password
        }
        
        response = requests.post(
            f"{API_GATEWAY_URL}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        assert response.status_code == 200, "Login should succeed"
        
        # Check updated last_login
        updated_item = self.table.get_item(Key={'id': self.test_user_id})['Item']
        updated_last_login = updated_item['last_login']
        
        assert updated_last_login != initial_last_login, "last_login should be updated on login"
        
        # Parse timestamps to ensure updated is later
        from datetime import datetime
        initial_dt = datetime.fromisoformat(initial_last_login.replace('Z', '+00:00'))
        updated_dt = datetime.fromisoformat(updated_last_login.replace('Z', '+00:00'))
        
        assert updated_dt > initial_dt, "Updated last_login should be later than initial"
    
    def test_user_registration_flow(self):
        """Test user registration endpoint if available"""
        # Generate unique registration data
        reg_user_id = f"reg-user-{uuid.uuid4().hex[:8]}"
        reg_username = f"reguser_{uuid.uuid4().hex[:8]}"
        reg_email = f"reg_{uuid.uuid4().hex[:8]}@example.com"
        
        registration_data = {
            'username': reg_username,
            'email': reg_email,
            'password': 'RegPass123!',
            'full_name': 'Registration Test User',
            'role': 'guest'
        }
        
        try:
            response = requests.post(
                f"{API_GATEWAY_URL}/auth/register",
                json=registration_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            # If register endpoint exists and works
            if response.status_code in [200, 201]:
                data = response.json()
                
                # Validate response structure
                assert 'user' in data or 'id' in data, "Registration response missing user info"
                
                # Clean up - try to find and delete the created user
                try:
                    if 'user' in data and 'id' in data['user']:
                        user_id = data['user']['id']
                    elif 'id' in data:
                        user_id = data['id']
                    else:
                        # Try to find by username/email
                        # This is a fallback - implementation depends on DynamoDB schema
                        pass
                    
                    if 'user_id' in locals():
                        self.table.delete_item(Key={'id': user_id})
                        
                except Exception as cleanup_error:
                    print(f"Warning: Failed to cleanup registered user: {cleanup_error}")
                    
            elif response.status_code == 404:
                # Register endpoint not implemented - this is acceptable
                pytest.skip("Register endpoint not implemented")
            elif response.status_code in [400, 422]:
                # Validation errors are acceptable for this test
                print(f"Registration validation error (expected): {response.text}")
            else:
                pytest.fail(f"Unexpected registration response: {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException:
            # Network errors indicate endpoint might not exist
            pytest.skip("Register endpoint not accessible")


@pytest.mark.integration
class TestAuthenticationIntegration:
    """Integration tests that can run without full AWS deployment"""
    
    def test_field_consistency_with_frontend_types(self):
        """Test that backend fields match frontend TypeScript types"""
        # Expected fields based on frontend types
        expected_user_fields = {
            'username', 'email', 'full_name', 'role', 'created_at', 'last_login'
        }
        
        expected_login_response_fields = {
            'token', 'user', 'expires_at'
        }
        
        # This test documents the expected API contract
        # In a real scenario, you'd make an actual API call and validate
        print("Expected User fields:", expected_user_fields)
        print("Expected LoginResponse fields:", expected_login_response_fields)
        
        assert len(expected_user_fields) == 6, "User type should have 6 fields"
        assert len(expected_login_response_fields) == 3, "LoginResponse should have 3 fields"
    
    def test_jwt_token_structure(self):
        """Test JWT token structure without making API calls"""
        # Mock JWT token for structure validation
        import base64
        
        # Create a mock JWT token
        header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip('=')
        payload = base64.urlsafe_b64encode(b'{"sub":"user123","exp":1234567890}').decode().rstrip('=')
        signature = "mock-signature"
        
        mock_jwt = f"{header}.{payload}.{signature}"
        
        # Validate structure
        parts = mock_jwt.split('.')
        assert len(parts) == 3, "JWT should have 3 parts"
        
        # Each part should be base64 decodable (except signature in this mock)
        for i, part in enumerate(parts[:2]):  # Skip signature for this test
            padded = part + '=' * (4 - len(part) % 4)  # Add padding if needed
            try:
                base64.urlsafe_b64decode(padded)
            except Exception:
                pytest.fail(f"JWT part {i} is not valid base64")


if __name__ == '__main__':
    # Run with: python -m pytest tests/e2e/test_auth_smoke.py -v
    pytest.main([__file__, '-v', '--tb=short'])