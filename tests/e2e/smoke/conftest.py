"""
Shared fixtures and utilities for smoke tests
Provides common setup, teardown, and helper functions for all smoke tests
"""

import pytest
import boto3
import json
import uuid
import hashlib
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import os


# Test configuration
AWS_PROFILE = 'personal'
AWS_REGION = 'us-east-1'
API_GATEWAY_URL = os.getenv('VITE_API_GATEWAY_URL', 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod')


@pytest.fixture(scope="session")
def aws_session():
    """Create AWS session with correct profile and region"""
    return boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)


@pytest.fixture(scope="session")
def dynamodb_resource(aws_session):
    """Create DynamoDB resource"""
    return aws_session.resource('dynamodb')


@pytest.fixture(scope="session")
def lambda_client(aws_session):
    """Create Lambda client"""
    return aws_session.client('lambda')


@pytest.fixture(scope="session")
def apigateway_client(aws_session):
    """Create API Gateway client"""
    return aws_session.client('apigateway')


@pytest.fixture(scope="session")
def api_gateway_url(apigateway_client):
    """Discover API Gateway URL automatically"""
    try:
        apis = apigateway_client.get_rest_apis()
        wedding_apis = [api for api in apis['items'] if 'heatherandwesley' in api['name']]
        
        if not wedding_apis:
            return API_GATEWAY_URL  # Fallback to environment variable
        
        # Get the main API
        api = next((api for api in wedding_apis if api['name'] == 'heatherandwesley-api'), wedding_apis[0])
        return f"https://{api['id']}.execute-api.{AWS_REGION}.amazonaws.com/prod"
        
    except Exception:
        return API_GATEWAY_URL  # Fallback to environment variable


@pytest.fixture(scope="session")
def test_session_id():
    """Generate unique session ID for test isolation"""
    return uuid.uuid4().hex[:8]


@pytest.fixture
def cleanup_tracker():
    """Track created items for cleanup"""
    tracker = {
        'users': [],
        'rsvps': [],
        'scores': []
    }
    
    yield tracker
    
    # Cleanup after test
    _cleanup_test_data(tracker)


def _cleanup_test_data(tracker: Dict[str, List[str]]):
    """Clean up test data from DynamoDB"""
    session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
    dynamodb = session.resource('dynamodb')
    
    # Clean up users table (users and RSVPs)
    if tracker['users'] or tracker['rsvps']:
        users_table = dynamodb.Table('heatherandwesley-users')
        for item_id in tracker['users'] + tracker['rsvps']:
            try:
                users_table.delete_item(Key={'id': item_id})
            except Exception as e:
                print(f"Warning: Failed to cleanup user/rsvp {item_id}: {e}")
    
    # Clean up leaderboard table
    if tracker['scores']:
        leaderboard_table = dynamodb.Table('heatherandwesley-leaderboard')
        for score_info in tracker['scores']:
            try:
                leaderboard_table.delete_item(
                    Key={
                        'game': score_info['game'],
                        'score_timestamp': score_info['score_timestamp']
                    }
                )
            except Exception as e:
                print(f"Warning: Failed to cleanup score {score_info}: {e}")


@pytest.fixture
def test_user_factory(dynamodb_resource, cleanup_tracker):
    """Factory for creating test users"""
    def create_test_user(username_suffix: str = None, **kwargs) -> Dict[str, Any]:
        session_id = uuid.uuid4().hex[:8]
        suffix = username_suffix or session_id
        
        user_data = {
            'id': f"test-user-{session_id}",
            'username': f"testuser_{suffix}",
            'email': f"test_{suffix}@example.com",
            'password': kwargs.get('password', 'TestPass123!'),
            'full_name': kwargs.get('full_name', f'Test User {suffix}'),
            'role': kwargs.get('role', 'guest'),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'last_login': datetime.now(timezone.utc).isoformat(),
        }
        
        # Hash password for storage
        password_hash = hashlib.sha256(user_data['password'].encode()).hexdigest()
        stored_data = user_data.copy()
        stored_data['password_hash'] = password_hash
        del stored_data['password']  # Don't store plain password
        
        # Store in DynamoDB
        users_table = dynamodb_resource.Table('heatherandwesley-users')
        users_table.put_item(Item=stored_data)
        
        # Track for cleanup
        cleanup_tracker['users'].append(user_data['id'])
        
        return user_data
    
    return create_test_user


@pytest.fixture
def test_rsvp_factory(api_gateway_url, cleanup_tracker):
    """Factory for creating test RSVPs"""
    def create_test_rsvp(name_suffix: str = None, **kwargs) -> Dict[str, Any]:
        import requests
        
        session_id = uuid.uuid4().hex[:8]
        suffix = name_suffix or session_id
        
        rsvp_data = {
            'name': kwargs.get('name', f'Test Guest {suffix}'),
            'email': kwargs.get('email', f'test_rsvp_{suffix}@example.com'),
            'attendance': kwargs.get('attendance', 'yes'),
            'dietary_restrictions': kwargs.get('dietary_restrictions', 'none'),
            'plus_one': kwargs.get('plus_one', False),
            'plus_one_name': kwargs.get('plus_one_name', ''),
            'guest_count': kwargs.get('guest_count', 1),
            'comments': kwargs.get('comments', f'Test RSVP {suffix}')
        }
        
        # Submit RSVP
        response = requests.post(
            f"{api_gateway_url}/rsvp",
            json=rsvp_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            response_data = response.json()
            rsvp_id = response_data.get('id')
            if rsvp_id:
                cleanup_tracker['rsvps'].append(rsvp_id)
            return {**rsvp_data, 'id': rsvp_id, 'response': response_data}
        else:
            raise Exception(f"Failed to create test RSVP: {response.status_code}: {response.text}")
    
    return create_test_rsvp


@pytest.fixture
def jwt_token_factory():
    """Factory for creating test JWT tokens"""
    def create_token(username: str = None, role: str = 'guest', expires_in_hours: int = 1) -> str:
        import jwt
        
        payload = {
            'username': username or f'testuser_{uuid.uuid4().hex[:8]}',
            'role': role,
            'exp': datetime.utcnow() + timedelta(hours=expires_in_hours),
            'iat': datetime.utcnow()
        }
        
        # Use a test secret - in real implementation this should match Lambda secret
        secret = os.environ.get('JWT_SECRET', 'development-secret-key-change-in-production')
        return jwt.encode(payload, secret, algorithm='HS256')
    
    return create_token


@pytest.fixture
def score_submission_helper(api_gateway_url, jwt_token_factory, cleanup_tracker):
    """Helper for submitting leaderboard scores"""
    def submit_score(game_type: str, score: int, character: str = 'wesley', username: str = None) -> Dict[str, Any]:
        import requests
        
        # Create auth token
        token = jwt_token_factory(username=username)
        
        score_data = {
            'score': score,
            'character': character
        }
        
        response = requests.post(
            f"{api_gateway_url}/leaderboard/{game_type}",
            json=score_data,
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            response_data = response.json()
            
            # Try to track for cleanup
            if 'leaderboard' in response_data:
                scores = response_data['leaderboard'].get('scores', [])
                if scores:
                    # Find the score we just submitted (should be the latest)
                    latest_score = scores[0]  # Assuming sorted by latest
                    if 'timestamp' in latest_score:
                        cleanup_tracker['scores'].append({
                            'game': game_type,
                            'score_timestamp': latest_score['timestamp']
                        })
            
            return {**score_data, 'response': response_data}
        else:
            raise Exception(f"Failed to submit score: {response.status_code}: {response.text}")
    
    return submit_score


class SmokeTestHelpers:
    """Collection of helper methods for smoke tests"""
    
    @staticmethod
    def wait_for_consistency(seconds: float = 1.0):
        """Wait for DynamoDB eventual consistency"""
        time.sleep(seconds)
    
    @staticmethod
    def validate_timestamp_format(timestamp_str: str) -> bool:
        """Validate timestamp is in ISO format"""
        try:
            datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            return True
        except ValueError:
            return False
    
    @staticmethod
    def validate_cors_headers(response_headers: Dict[str, str], origin: str = None) -> bool:
        """Validate CORS headers are present and correct"""
        required_headers = ['Access-Control-Allow-Origin']
        
        for header in required_headers:
            if header not in response_headers:
                return False
        
        if origin:
            allow_origin = response_headers.get('Access-Control-Allow-Origin')
            if allow_origin not in ['*', origin]:
                return False
        
        return True
    
    @staticmethod
    def validate_jwt_structure(token: str) -> bool:
        """Validate JWT token has correct structure"""
        parts = token.split('.')
        return len(parts) == 3
    
    @staticmethod
    def extract_api_gateway_id(api_url: str) -> Optional[str]:
        """Extract API Gateway ID from URL"""
        import re
        match = re.search(r'https://([a-z0-9]+)\.execute-api\.', api_url)
        return match.group(1) if match else None


@pytest.fixture
def smoke_helpers():
    """Provide access to helper methods"""
    return SmokeTestHelpers


# Pytest markers for smoke tests
pytest_plugins = []

def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "smoke: mark test as a smoke test for critical functionality"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers automatically"""
    for item in items:
        # Auto-mark smoke tests
        if "smoke" in item.nodeid:
            item.add_marker(pytest.mark.smoke)
        
        # Auto-mark slow tests
        if any(keyword in item.name.lower() for keyword in ['performance', 'concurrent', 'chain']):
            item.add_marker(pytest.mark.slow)