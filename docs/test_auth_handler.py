#!/usr/bin/env python3
"""
Test script for auth-handler.py
This script helps validate the auth handler logic locally
"""

import json
import sys
import os

# Add the lambda directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../aws/lambda'))

# Mock the boto3 DynamoDB table for testing
class MockTable:
    def __init__(self):
        self.data = {}
    
    def get_item(self, Key):
        username = Key.get('username')
        if username in self.data:
            return {'Item': self.data[username]}
        return {}
    
    def put_item(self, Item):
        self.data[Item['username']] = Item
        return True
    
    def update_item(self, Key, UpdateExpression, ExpressionAttributeValues):
        username = Key.get('username')
        if username in self.data:
            # Simple update for last_login
            if 'last_login' in UpdateExpression:
                self.data[username]['last_login'] = ExpressionAttributeValues[':last_login']
        return True

# Mock boto3
class MockDynamoDB:
    def Table(self, name):
        return MockTable()

class MockBoto3:
    def resource(self, service):
        if service == 'dynamodb':
            return MockDynamoDB()
        return None

# Replace boto3 with mock
sys.modules['boto3'] = MockBoto3()

# Now import the handler
from auth_handler import lambda_handler

def test_register():
    """Test user registration"""
    print("Testing user registration...")
    
    event = {
        'httpMethod': 'POST',
        'path': '/auth/register',
        'body': json.dumps({
            'username': 'testuser',
            'password': 'testpass123',
            'email': 'test@example.com',
            'full_name': 'Test User',
            'role': 'guest'
        })
    }
    
    response = lambda_handler(event, {})
    print(f"Response: {json.dumps(response, indent=2)}")
    
    # Check response
    assert response['statusCode'] == 201
    body = json.loads(response['body'])
    assert 'token' in body
    assert body['user']['username'] == 'testuser'
    print("✓ Registration test passed\n")
    
    return body['token']

def test_login():
    """Test user login"""
    print("Testing user login...")
    
    # First register a user
    test_register()
    
    # Now try to login
    event = {
        'httpMethod': 'POST',
        'path': '/auth/login',
        'body': json.dumps({
            'username': 'testuser',
            'password': 'testpass123'
        })
    }
    
    response = lambda_handler(event, {})
    print(f"Response: {json.dumps(response, indent=2)}")
    
    # Check response
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'token' in body
    assert body['user']['username'] == 'testuser'
    print("✓ Login test passed\n")
    
    return body['token']

def test_verify(token):
    """Test token verification"""
    print("Testing token verification...")
    
    event = {
        'httpMethod': 'POST',
        'path': '/auth/verify',
        'body': json.dumps({
            'token': token
        })
    }
    
    response = lambda_handler(event, {})
    print(f"Response: {json.dumps(response, indent=2)}")
    
    # Check response
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert body['user']['username'] == 'testuser'
    print("✓ Token verification test passed\n")

def test_invalid_login():
    """Test invalid login attempts"""
    print("Testing invalid login...")
    
    # Wrong password
    event = {
        'httpMethod': 'POST',
        'path': '/auth/login',
        'body': json.dumps({
            'username': 'testuser',
            'password': 'wrongpass'
        })
    }
    
    response = lambda_handler(event, {})
    assert response['statusCode'] == 401
    print("✓ Invalid password test passed")
    
    # Non-existent user
    event['body'] = json.dumps({
        'username': 'nonexistent',
        'password': 'anypass'
    })
    
    response = lambda_handler(event, {})
    assert response['statusCode'] == 401
    print("✓ Non-existent user test passed\n")

def test_cors():
    """Test CORS headers"""
    print("Testing CORS headers...")
    
    # OPTIONS request
    event = {
        'httpMethod': 'OPTIONS',
        'path': '/auth/login'
    }
    
    response = lambda_handler(event, {})
    assert response['statusCode'] == 200
    assert 'Access-Control-Allow-Origin' in response['headers']
    assert response['headers']['Access-Control-Allow-Origin'] == '*'
    print("✓ CORS test passed\n")

if __name__ == '__main__':
    print("Running auth handler tests...\n")
    
    try:
        test_cors()
        token = test_login()  # This also tests registration
        test_verify(token)
        test_invalid_login()
        
        print("All tests passed! ✅")
    except AssertionError as e:
        print(f"Test failed: {e} ❌")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e} ❌")
        sys.exit(1)