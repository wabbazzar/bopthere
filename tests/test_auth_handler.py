#!/usr/bin/env python3
"""
Comprehensive security-focused test suite for auth-handler.py
Tests authentication endpoints with focus on security vulnerabilities and edge cases
"""

import json
import pytest
import jwt
import bcrypt
import base64
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
from decimal import Decimal
import os
import sys

# Add the lambda directory to the path for importing auth handler
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'aws', 'lambda'))


class TestAuthHandlerSecurity:
    """Test suite for authentication handler with security focus"""
    
    @pytest.fixture
    def mock_dynamodb_table(self):
        """Mock DynamoDB table for testing"""
        mock_table = Mock()
        mock_table.data = {}
        
        def mock_get_item(Key):
            username = Key.get('username')
            if username in mock_table.data:
                return {'Item': mock_table.data[username]}
            return {}
        
        def mock_put_item(Item):
            mock_table.data[Item['username']] = Item
            return True
        
        def mock_update_item(Key, **kwargs):
            username = Key.get('username')
            if username in mock_table.data:
                # Simple update for last_login
                expression_values = kwargs.get('ExpressionAttributeValues', {})
                if ':last_login' in expression_values:
                    mock_table.data[username]['last_login'] = expression_values[':last_login']
            return True
        
        mock_table.get_item.side_effect = mock_get_item
        mock_table.put_item.side_effect = mock_put_item
        mock_table.update_item.side_effect = mock_update_item
        
        return mock_table
    
    @pytest.fixture
    def mock_boto3(self, mock_dynamodb_table):
        """Mock boto3 DynamoDB resource"""
        with patch('boto3.resource') as mock_resource:
            mock_dynamodb = Mock()
            mock_dynamodb.Table.return_value = mock_dynamodb_table
            mock_resource.return_value = mock_dynamodb
            yield mock_resource
    
    @pytest.fixture
    def auth_handler(self, mock_boto3):
        """Import auth handler with mocked dependencies"""
        # Mock environment variables
        with patch.dict(os.environ, {
            'TABLE_NAME': 'test-users-table',
            'JWT_SECRET': 'test-secret-key-for-testing'
        }):
            # Import after mocking
            import importlib.util
            spec = importlib.util.spec_from_file_location("auth_handler", 
                os.path.join(os.path.dirname(__file__), '..', 'aws', 'lambda', 'auth-handler.py'))
            auth_handler_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(auth_handler_module)
            return auth_handler_module.lambda_handler
    
    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing"""
        return {
            'username': 'testuser',
            'password': 'SecurePass123!',
            'email': 'test@example.com',
            'full_name': 'Test User',
            'role': 'guest'
        }
    
    @pytest.fixture
    def existing_user(self, mock_dynamodb_table):
        """Create an existing user in mock database"""
        password_hash = bcrypt.hashpw('SecurePass123!'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_data = {
            'username': 'existinguser',
            'password_hash': password_hash,
            'email': 'existing@example.com',
            'full_name': 'Existing User',
            'role': 'guest',
            'created_at': '2024-01-01T00:00:00Z',
            'last_login': '2024-01-01T00:00:00Z'
        }
        mock_dynamodb_table.data['existinguser'] = user_data
        return user_data


class TestLoginEndpoint(TestAuthHandlerSecurity):
    """Test cases for /auth/login endpoint"""
    
    def test_valid_login_success(self, auth_handler, existing_user):
        """Test successful login with valid credentials"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'existinguser',
                'password': 'SecurePass123!'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 200
        assert 'Access-Control-Allow-Origin' in response['headers']
        
        body = json.loads(response['body'])
        assert body['message'] == 'Login successful'
        assert 'token' in body
        assert 'user' in body
        assert body['user']['username'] == 'existinguser'
        assert body['user']['email'] == 'existing@example.com'
        assert 'password_hash' not in body['user']  # Ensure password not exposed
    
    def test_login_missing_username(self, auth_handler):
        """Test login with missing username field"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'password': 'SecurePass123!'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Username and password are required' in body['error']
    
    def test_login_missing_password(self, auth_handler):
        """Test login with missing password field"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'testuser'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Username and password are required' in body['error']
    
    def test_login_empty_credentials(self, auth_handler):
        """Test login with empty username and password"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': '',
                'password': ''
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Username and password are required' in body['error']
    
    def test_login_invalid_username(self, auth_handler):
        """Test login with non-existent username"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'nonexistentuser',
                'password': 'SecurePass123!'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Invalid username or password' in body['error']
    
    def test_login_invalid_password(self, auth_handler, existing_user):
        """Test login with incorrect password"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'existinguser',
                'password': 'WrongPassword123!'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Invalid username or password' in body['error']
    
    def test_login_malformed_json(self, auth_handler):
        """Test login with malformed JSON body"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': '{"username": "test", "password":'  # Incomplete JSON
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert 'Internal server error' in body['error']
    
    def test_login_no_body(self, auth_handler):
        """Test login with no request body"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login'
            # No body field
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Username and password are required' in body['error']


class TestRegistrationEndpoint(TestAuthHandlerSecurity):
    """Test cases for /auth/register endpoint"""
    
    def test_valid_registration_success(self, auth_handler, sample_user_data):
        """Test successful user registration"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(sample_user_data)
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 201
        assert 'Access-Control-Allow-Origin' in response['headers']
        
        body = json.loads(response['body'])
        assert body['message'] == 'User registered successfully'
        assert 'token' in body
        assert 'user' in body
        assert body['user']['username'] == sample_user_data['username']
        assert body['user']['email'] == sample_user_data['email']
        assert 'password' not in body['user']  # Ensure password not exposed
    
    def test_registration_missing_username(self, auth_handler, sample_user_data):
        """Test registration with missing username"""
        del sample_user_data['username']
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(sample_user_data)
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Missing required field: username' in body['error']
    
    def test_registration_missing_password(self, auth_handler, sample_user_data):
        """Test registration with missing password"""
        del sample_user_data['password']
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(sample_user_data)
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Missing required field: password' in body['error']
    
    def test_registration_missing_email(self, auth_handler, sample_user_data):
        """Test registration with missing email"""
        del sample_user_data['email']
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(sample_user_data)
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Missing required field: email' in body['error']
    
    def test_registration_missing_full_name(self, auth_handler, sample_user_data):
        """Test registration with missing full_name"""
        del sample_user_data['full_name']
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(sample_user_data)
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Missing required field: full_name' in body['error']
    
    def test_registration_duplicate_username(self, auth_handler, existing_user):
        """Test registration with existing username"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps({
                'username': 'existinguser',  # Same as existing user
                'password': 'NewPassword123!',
                'email': 'new@example.com',
                'full_name': 'New User'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 409
        body = json.loads(response['body'])
        assert 'Username already exists' in body['error']
    
    def test_registration_default_role(self, auth_handler):
        """Test registration uses default guest role when not specified"""
        user_data = {
            'username': 'newuser',
            'password': 'SecurePass123!',
            'email': 'new@example.com',
            'full_name': 'New User'
            # No role specified
        }
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(user_data)
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 201
        body = json.loads(response['body'])
        assert body['user']['role'] == 'guest'


class TestTokenVerification(TestAuthHandlerSecurity):
    """Test cases for /auth/verify endpoint"""
    
    @pytest.fixture
    def valid_token(self, auth_handler, existing_user):
        """Generate a valid JWT token for testing"""
        with patch.dict(os.environ, {'JWT_SECRET': 'test-secret-key-for-testing'}):
            import importlib.util
            spec = importlib.util.spec_from_file_location("auth_handler", 
                os.path.join(os.path.dirname(__file__), '..', 'aws', 'lambda', 'auth-handler.py'))
            auth_handler_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(auth_handler_module)
            return auth_handler_module.generate_token('existinguser', 'guest')
    
    def test_valid_token_verification(self, auth_handler, existing_user, valid_token):
        """Test verification of valid JWT token"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'body': json.dumps({
                'token': valid_token
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['message'] == 'Token is valid'
        assert body['user']['username'] == 'existinguser'
    
    def test_token_in_authorization_header(self, auth_handler, existing_user, valid_token):
        """Test token verification using Authorization header"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'headers': {
                'Authorization': f'Bearer {valid_token}'
            },
            'body': json.dumps({})
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['message'] == 'Token is valid'
        assert body['user']['username'] == 'existinguser'
    
    def test_missing_token(self, auth_handler):
        """Test verification with missing token"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'body': json.dumps({})
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'Token is required' in body['error']
    
    def test_expired_token(self, auth_handler, existing_user):
        """Test verification of expired token"""
        # Generate an expired token
        with patch.dict(os.environ, {'JWT_SECRET': 'test-secret-key-for-testing'}):
            payload = {
                'username': 'existinguser',
                'role': 'guest',
                'exp': datetime.utcnow() - timedelta(hours=1),  # Expired 1 hour ago
                'iat': datetime.utcnow() - timedelta(hours=2)
            }
            expired_token = jwt.encode(payload, 'test-secret-key-for-testing', algorithm='HS256')
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'body': json.dumps({
                'token': expired_token
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Invalid or expired token' in body['error']
    
    def test_malformed_token(self, auth_handler):
        """Test verification of malformed token"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'body': json.dumps({
                'token': 'this.is.not.a.valid.jwt.token'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Invalid or expired token' in body['error']
    
    def test_token_for_nonexistent_user(self, auth_handler):
        """Test verification of token for user that no longer exists"""
        # Generate token for non-existent user
        with patch.dict(os.environ, {'JWT_SECRET': 'test-secret-key-for-testing'}):
            payload = {
                'username': 'deleteduser',
                'role': 'guest',
                'exp': datetime.utcnow() + timedelta(hours=24),
                'iat': datetime.utcnow()
            }
            token = jwt.encode(payload, 'test-secret-key-for-testing', algorithm='HS256')
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'body': json.dumps({
                'token': token
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'User not found' in body['error']


class TestCORSHandling(TestAuthHandlerSecurity):
    """Test CORS headers and preflight requests"""
    
    def test_options_preflight_request(self, auth_handler):
        """Test OPTIONS preflight request handling"""
        event = {
            'httpMethod': 'OPTIONS',
            'path': '/auth/login'
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 200
        assert response['body'] == ''
        
        headers = response['headers']
        assert headers['Access-Control-Allow-Origin'] == '*'
        assert 'Content-Type, Authorization' in headers['Access-Control-Allow-Headers']
        assert 'GET, POST, OPTIONS' in headers['Access-Control-Allow-Methods']
    
    def test_cors_headers_in_all_responses(self, auth_handler):
        """Test that all responses include CORS headers"""
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'test',
                'password': 'test'
            })
        }
        
        response = auth_handler(event, {})
        
        # Even error responses should have CORS headers
        headers = response['headers']
        assert 'Access-Control-Allow-Origin' in headers
        assert headers['Access-Control-Allow-Origin'] == '*'


class TestSecurityVulnerabilities(TestAuthHandlerSecurity):
    """Test for common security vulnerabilities"""
    
    def test_sql_injection_attempts_username(self, auth_handler):
        """Test SQL injection attempts in username field (though DynamoDB isn't SQL-based)"""
        injection_attempts = [
            "admin'; DROP TABLE users; --",
            "' OR '1'='1",
            "admin' UNION SELECT * FROM users --",
            "'; DELETE FROM users WHERE '1'='1"
        ]
        
        for injection_attempt in injection_attempts:
            event = {
                'httpMethod': 'POST',
                'path': '/auth/login',
                'body': json.dumps({
                    'username': injection_attempt,
                    'password': 'testpass'
                })
            }
            
            response = auth_handler(event, {})
            # Should handle gracefully without crashes
            assert response['statusCode'] in [401, 500]
    
    def test_xss_prevention_in_responses(self, auth_handler):
        """Test XSS prevention in error responses"""
        xss_payload = "<script>alert('XSS')</script>"
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': xss_payload,
                'password': 'testpass'
            })
        }
        
        response = auth_handler(event, {})
        
        # Ensure XSS payload is not reflected in response
        response_body = response['body']
        assert '<script>' not in response_body
        assert 'alert(' not in response_body
    
    def test_buffer_overflow_long_inputs(self, auth_handler):
        """Test handling of excessively long inputs"""
        very_long_string = 'A' * 10000  # 10KB string
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps({
                'username': very_long_string,
                'password': very_long_string,
                'email': very_long_string + '@example.com',
                'full_name': very_long_string
            })
        }
        
        response = auth_handler(event, {})
        
        # Should handle gracefully without crashes
        assert response['statusCode'] in [400, 500]
    
    def test_special_characters_handling(self, auth_handler):
        """Test handling of special characters in inputs"""
        special_chars_tests = [
            {'username': 'user\x00null', 'password': 'pass'},
            {'username': 'user\r\n', 'password': 'pass'},
            {'username': 'user\t\t', 'password': 'pass'},
            {'username': 'user€£¥', 'password': 'pass€£¥'},
            {'username': 'user\\\\', 'password': 'pass\\\\'}
        ]
        
        for test_data in special_chars_tests:
            event = {
                'httpMethod': 'POST',
                'path': '/auth/login',
                'body': json.dumps(test_data)
            }
            
            response = auth_handler(event, {})
            # Should handle gracefully
            assert response['statusCode'] in [401, 500]
    
    def test_timing_attack_resistance(self, auth_handler, existing_user):
        """Test that password verification doesn't leak timing information"""
        import time
        
        # Measure time for valid user with wrong password
        start_time = time.time()
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'existinguser',
                'password': 'wrongpassword'
            })
        }
        auth_handler(event, {})
        valid_user_time = time.time() - start_time
        
        # Measure time for non-existent user
        start_time = time.time()
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'nonexistentuser',
                'password': 'anypassword'
            })
        }
        auth_handler(event, {})
        invalid_user_time = time.time() - start_time
        
        # Time difference should be reasonable (within 100ms for unit tests)
        # This is a basic timing check - in production, more sophisticated analysis would be needed
        time_difference = abs(valid_user_time - invalid_user_time)
        assert time_difference < 0.1  # 100ms threshold
    
    def test_password_hash_verification(self, auth_handler, sample_user_data, mock_dynamodb_table):
        """Test that passwords are properly hashed and verified"""
        # Register a user
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(sample_user_data)
        }
        
        response = auth_handler(event, {})
        assert response['statusCode'] == 201
        
        # Check that password was hashed in database
        stored_user = mock_dynamodb_table.data[sample_user_data['username']]
        assert 'password_hash' in stored_user
        assert stored_user['password_hash'] != sample_user_data['password']  # Should be hashed
        assert stored_user['password_hash'].startswith('$2b$')  # bcrypt hash format
        
        # Verify the hash can be used for login
        login_event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': sample_user_data['username'],
                'password': sample_user_data['password']
            })
        }
        
        login_response = auth_handler(login_event, {})
        assert login_response['statusCode'] == 200


class TestJWTTokenSecurity(TestAuthHandlerSecurity):
    """Test JWT token generation and validation security"""
    
    def test_jwt_token_structure(self, auth_handler, sample_user_data):
        """Test JWT token has proper structure and claims"""
        # Register and get token
        event = {
            'httpMethod': 'POST',
            'path': '/auth/register',
            'body': json.dumps(sample_user_data)
        }
        
        response = auth_handler(event, {})
        assert response['statusCode'] == 201
        
        body = json.loads(response['body'])
        token = body['token']
        
        # Decode token (without verification for testing)
        with patch.dict(os.environ, {'JWT_SECRET': 'test-secret-key-for-testing'}):
            decoded = jwt.decode(token, 'test-secret-key-for-testing', algorithms=['HS256'])
            
            # Check required claims
            assert 'username' in decoded
            assert 'role' in decoded
            assert 'exp' in decoded
            assert 'iat' in decoded
            
            # Check values
            assert decoded['username'] == sample_user_data['username']
            assert decoded['role'] == sample_user_data.get('role', 'guest')
    
    def test_jwt_token_tampering(self, auth_handler, existing_user, valid_token):
        """Test that tampered tokens are rejected"""
        # Tamper with token by modifying last character
        tampered_token = valid_token[:-1] + 'X'
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'body': json.dumps({
                'token': tampered_token
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Invalid or expired token' in body['error']
    
    def test_jwt_wrong_secret(self, auth_handler, existing_user):
        """Test that tokens signed with wrong secret are rejected"""
        # Generate token with wrong secret
        payload = {
            'username': 'existinguser',
            'role': 'guest',
            'exp': datetime.utcnow() + timedelta(hours=24),
            'iat': datetime.utcnow()
        }
        wrong_secret_token = jwt.encode(payload, 'wrong-secret', algorithm='HS256')
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/verify',
            'body': json.dumps({
                'token': wrong_secret_token
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert 'Invalid or expired token' in body['error']


class TestErrorHandling(TestAuthHandlerSecurity):
    """Test error handling and edge cases"""
    
    def test_unsupported_http_method(self, auth_handler):
        """Test unsupported HTTP methods"""
        unsupported_methods = ['GET', 'PUT', 'DELETE', 'PATCH']
        
        for method in unsupported_methods:
            event = {
                'httpMethod': method,
                'path': '/auth/login'
            }
            
            response = auth_handler(event, {})
            assert response['statusCode'] == 404
            body = json.loads(response['body'])
            assert 'Endpoint not found' in body['error']
    
    def test_invalid_endpoint_path(self, auth_handler):
        """Test requests to invalid endpoint paths"""
        invalid_paths = [
            '/auth/invalid',
            '/auth/',
            '/auth',
            '/invalid/path',
            '/'
        ]
        
        for path in invalid_paths:
            event = {
                'httpMethod': 'POST',
                'path': path,
                'body': json.dumps({'test': 'data'})
            }
            
            response = auth_handler(event, {})
            assert response['statusCode'] == 404
            body = json.loads(response['body'])
            assert 'Endpoint not found' in body['error']
    
    def test_database_error_handling(self, auth_handler, mock_dynamodb_table):
        """Test handling of database errors"""
        # Mock DynamoDB error
        mock_dynamodb_table.get_item.side_effect = Exception("DynamoDB connection error")
        
        event = {
            'httpMethod': 'POST',
            'path': '/auth/login',
            'body': json.dumps({
                'username': 'testuser',
                'password': 'testpass'
            })
        }
        
        response = auth_handler(event, {})
        
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert 'Internal server error' in body['error']
    
    def test_bcrypt_error_handling(self, auth_handler):
        """Test handling of bcrypt errors"""
        with patch('bcrypt.checkpw', side_effect=Exception("Bcrypt error")):
            event = {
                'httpMethod': 'POST',
                'path': '/auth/login',
                'body': json.dumps({
                    'username': 'testuser',
                    'password': 'testpass'
                })
            }
            
            response = auth_handler(event, {})
            
            assert response['statusCode'] == 500
            body = json.loads(response['body'])
            assert 'Internal server error' in body['error']
    
    def test_jwt_encoding_error_handling(self, auth_handler, sample_user_data):
        """Test handling of JWT encoding errors"""
        with patch('jwt.encode', side_effect=Exception("JWT encoding error")):
            event = {
                'httpMethod': 'POST',
                'path': '/auth/register',
                'body': json.dumps(sample_user_data)
            }
            
            response = auth_handler(event, {})
            
            assert response['statusCode'] == 500
            body = json.loads(response['body'])
            assert 'Internal server error' in body['error']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])