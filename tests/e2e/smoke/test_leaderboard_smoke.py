"""
E2E smoke tests for Tournament Leaderboard System
Tests the complete Gateway → Lambda → DynamoDB flow
"""
import pytest
import boto3
import json
import time
from datetime import datetime, timedelta
import jwt
import os

# Test configuration
AWS_PROFILE = 'personal'
LAMBDA_NAME = 'heatherandwesley-leaderboard-handler'
AUTH_LAMBDA_NAME = 'heatherandwesley-auth-handler'
TABLE_NAME = 'heatherandwesley-leaderboard'
JWT_SECRET = os.environ.get('JWT_SECRET', 'development-secret-key-change-in-production')


class TestLeaderboardSmoke:
    """E2E smoke tests for leaderboard functionality"""
    
    @classmethod
    def setup_class(cls):
        """Set up test environment"""
        session = boto3.Session(profile_name=AWS_PROFILE)
        cls.lambda_client = session.client('lambda')
        cls.dynamodb = session.resource('dynamodb')
        cls.table = cls.dynamodb.Table(TABLE_NAME)
        
        # Clean up test data from previous runs
        cls._cleanup_test_data()
    
    @classmethod
    def teardown_class(cls):
        """Clean up after tests"""
        cls._cleanup_test_data()
    
    @classmethod
    def _cleanup_test_data(cls):
        """Remove test data from DynamoDB"""
        try:
            # Query all tetris-test scores
            response = cls.table.query(
                KeyConditionExpression='game = :game',
                ExpressionAttributeValues={':game': 'tetris-test'}
            )
            
            # Delete each item
            for item in response.get('Items', []):
                cls.table.delete_item(
                    Key={
                        'game': item['game'],
                        'score_timestamp': item['score_timestamp']
                    }
                )
        except Exception as e:
            print(f"Cleanup error (non-critical): {e}")
    
    def _create_test_token(self, username='testuser'):
        """Create a test JWT token"""
        payload = {
            'username': username,
            'role': 'guest',
            'exp': datetime.utcnow() + timedelta(hours=1),
            'iat': datetime.utcnow()
        }
        return jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    
    def _invoke_lambda(self, payload):
        """Invoke Lambda function and return parsed response"""
        response = self.lambda_client.invoke(
            FunctionName=LAMBDA_NAME,
            InvocationType='RequestResponse',
            Payload=json.dumps(payload)
        )
        
        result = json.loads(response['Payload'].read())
        return result
    
    def test_get_empty_leaderboard(self):
        """Test GET request for empty leaderboard"""
        payload = {
            'httpMethod': 'GET',
            'path': '/leaderboard/tetris-test',
            'headers': {}
        }
        
        result = self._invoke_lambda(payload)
        
        # Verify response structure
        assert result['statusCode'] == 200
        assert 'headers' in result
        assert 'Access-Control-Allow-Origin' in result['headers']
        
        # Parse body
        body = json.loads(result['body'])
        assert body['game'] == 'tetris-test'
        assert body['scores'] == []
        assert body['total_players'] == 0
    
    def test_cors_headers(self):
        """Test CORS headers are properly set"""
        # Test with production origin
        payload = {
            'httpMethod': 'GET',
            'path': '/leaderboard/tetris-test',
            'headers': {
                'origin': 'https://heatherandwesley.com'
            }
        }
        
        result = self._invoke_lambda(payload)
        headers = result['headers']
        
        assert headers['Access-Control-Allow-Origin'] == 'https://heatherandwesley.com'
        assert headers['Access-Control-Allow-Methods'] == 'GET, POST, OPTIONS'
        assert headers['Access-Control-Allow-Credentials'] == 'true'
        
        # Test with localhost origin
        payload['headers']['origin'] = 'http://localhost:5173'
        result = self._invoke_lambda(payload)
        headers = result['headers']
        
        assert headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
    
    def test_options_preflight(self):
        """Test OPTIONS preflight request"""
        payload = {
            'httpMethod': 'OPTIONS',
            'path': '/leaderboard/tetris-test',
            'headers': {
                'origin': 'https://heatherandwesley.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        }
        
        result = self._invoke_lambda(payload)
        
        assert result['statusCode'] == 200
        assert result['body'] == ''
        assert 'Access-Control-Allow-Origin' in result['headers']
        assert 'Access-Control-Allow-Methods' in result['headers']
        assert 'Access-Control-Allow-Headers' in result['headers']
    
    def test_submit_score_unauthorized(self):
        """Test POST request without authentication"""
        payload = {
            'httpMethod': 'POST',
            'path': '/leaderboard/tetris-test',
            'headers': {},
            'body': json.dumps({
                'score': 1000,
                'character': 'wesley'
            })
        }
        
        result = self._invoke_lambda(payload)
        
        assert result['statusCode'] == 401
        body = json.loads(result['body'])
        assert 'error' in body
        assert body['error'] == 'Authorization required'
    
    def test_submit_score_with_auth(self):
        """Test complete score submission flow with authentication"""
        # Create test token
        token = self._create_test_token('smoketest-user')
        
        # Submit score
        payload = {
            'httpMethod': 'POST',
            'path': '/leaderboard/tetris-test',
            'headers': {
                'Authorization': f'Bearer {token}'
            },
            'body': json.dumps({
                'score': 5000,
                'character': 'heather'
            })
        }
        
        result = self._invoke_lambda(payload)
        
        assert result['statusCode'] == 201
        body = json.loads(result['body'])
        assert body['message'] == 'Score submitted successfully'
        assert 'leaderboard' in body
        assert body['leaderboard']['total_players'] == 1
        assert len(body['leaderboard']['scores']) == 1
        assert body['leaderboard']['scores'][0]['username'] == 'smoketest-user'
        assert body['leaderboard']['scores'][0]['score'] == 5000
        assert body['leaderboard']['scores'][0]['character'] == 'heather'
    
    def test_leaderboard_top_10_maintenance(self):
        """Test that leaderboard maintains only top 10 scores"""
        token = self._create_test_token('smoketest-bulk')
        
        # Submit 12 scores
        for i in range(12):
            payload = {
                'httpMethod': 'POST',
                'path': '/leaderboard/tetris-test',
                'headers': {
                    'Authorization': f'Bearer {token}'
                },
                'body': json.dumps({
                    'score': (i + 1) * 100,  # 100, 200, 300... 1200
                    'character': 'puffy'
                })
            }
            
            result = self._invoke_lambda(payload)
            assert result['statusCode'] == 201
            time.sleep(0.1)  # Small delay to ensure different timestamps
        
        # Get leaderboard
        get_payload = {
            'httpMethod': 'GET',
            'path': '/leaderboard/tetris-test',
            'headers': {}
        }
        
        result = self._invoke_lambda(get_payload)
        body = json.loads(result['body'])
        
        # Should only have 10 scores
        assert len(body['scores']) == 10
        
        # Should be sorted in descending order
        scores = [s['score'] for s in body['scores']]
        assert scores == sorted(scores, reverse=True)
        
        # Lowest score should be 300 (not 100 or 200)
        assert min(scores) >= 300
    
    def test_field_validation(self):
        """Test that all fields match the exact schema from ticket"""
        token = self._create_test_token('field-test-user')
        
        # Submit a score
        payload = {
            'httpMethod': 'POST',
            'path': '/leaderboard/tetris-test',
            'headers': {
                'Authorization': f'Bearer {token}'
            },
            'body': json.dumps({
                'score': 9999,
                'character': 'wesley'
            })
        }
        
        result = self._invoke_lambda(payload)
        assert result['statusCode'] == 201
        
        # Get the score back
        get_payload = {
            'httpMethod': 'GET',
            'path': '/leaderboard/tetris-test',
            'headers': {}
        }
        
        result = self._invoke_lambda(get_payload)
        body = json.loads(result['body'])
        
        # Verify exact field names from ticket
        assert 'game' in body
        assert 'scores' in body
        assert 'total_players' in body
        
        # Verify score fields
        score = body['scores'][0]
        assert 'username' in score
        assert 'score' in score
        assert 'timestamp' in score
        assert 'character' in score
        
        # Verify field types
        assert isinstance(body['game'], str)
        assert isinstance(body['scores'], list)
        assert isinstance(body['total_players'], int)
        assert isinstance(score['username'], str)
        assert isinstance(score['score'], (int, float))
        assert isinstance(score['timestamp'], str)
        assert isinstance(score['character'], str)
    
    def test_error_handling(self):
        """Test error responses include CORS headers"""
        # Test invalid endpoint
        payload = {
            'httpMethod': 'GET',
            'path': '/invalid',
            'headers': {
                'origin': 'https://heatherandwesley.com'
            }
        }
        
        result = self._invoke_lambda(payload)
        
        assert result['statusCode'] == 404
        assert 'Access-Control-Allow-Origin' in result['headers']
        assert result['headers']['Access-Control-Allow-Origin'] == 'https://heatherandwesley.com'
        
        # Test missing required fields
        token = self._create_test_token('error-test')
        payload = {
            'httpMethod': 'POST',
            'path': '/leaderboard/tetris-test',
            'headers': {
                'Authorization': f'Bearer {token}',
                'origin': 'https://heatherandwesley.com'
            },
            'body': json.dumps({
                # Missing score and character
            })
        }
        
        result = self._invoke_lambda(payload)
        
        assert result['statusCode'] == 400
        assert 'Access-Control-Allow-Origin' in result['headers']
        body = json.loads(result['body'])
        assert 'error' in body


if __name__ == '__main__':
    pytest.main([__file__, '-v'])