"""
Integration tests for Leaderboard API Gateway endpoints
Tests the full API Gateway → Lambda → DynamoDB flow
"""
import json
import os
import time
from datetime import datetime, timedelta

import jwt
import pytest
import requests

# API configuration
API_ENDPOINT = "https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod"
JWT_SECRET = os.environ.get("JWT_SECRET", "development-secret-key-change-in-production")


class TestLeaderboardAPI:
    """Integration tests for leaderboard API endpoints"""

    @classmethod
    def setup_class(cls):
        """Set up test environment"""
        cls.api_url = f"{API_ENDPOINT}/leaderboard/api-test"
        cls.headers = {
            "Content-Type": "application/json",
            "Origin": "https://heatherandwesley.com",
        }

    def _create_test_token(self, username="api-test-user"):
        """Create a test JWT token"""
        payload = {
            "username": username,
            "role": "guest",
            "exp": datetime.utcnow() + timedelta(hours=1),
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    def test_get_leaderboard_cors(self):
        """Test GET request returns proper CORS headers"""
        response = requests.get(self.api_url, headers=self.headers)

        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert (
            response.headers["access-control-allow-origin"]
            == "https://heatherandwesley.com"
        )
        assert "access-control-allow-methods" in response.headers
        assert "GET" in response.headers["access-control-allow-methods"]

    def test_options_preflight(self):
        """Test OPTIONS preflight request"""
        headers = {
            "Origin": "https://heatherandwesley.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, Authorization",
        }

        response = requests.options(self.api_url, headers=headers)

        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
        assert "access-control-allow-headers" in response.headers
        assert "access-control-max-age" in response.headers

    def test_post_without_auth(self):
        """Test POST without authentication fails"""
        data = {"score": 1000, "character": "wesley"}

        response = requests.post(self.api_url, json=data, headers=self.headers)

        assert response.status_code == 401
        assert response.json()["error"] == "Authorization required"
        # Should still have CORS headers on error
        assert "access-control-allow-origin" in response.headers

    def test_post_with_auth(self):
        """Test POST with authentication succeeds"""
        pytest.skip("Requires real JWT secret from Lambda environment - skipping in CI")

        token = self._create_test_token("api-integration-test")
        auth_headers = self.headers.copy()
        auth_headers["Authorization"] = f"Bearer {token}"

        data = {"score": 99999, "character": "heather"}

        response = requests.post(self.api_url, json=data, headers=auth_headers)

        assert response.status_code == 201
        result = response.json()
        assert result["message"] == "Score submitted successfully"
        assert "leaderboard" in result
        assert len(result["leaderboard"]["scores"]) > 0

        # Verify the submitted score is in the leaderboard
        scores = result["leaderboard"]["scores"]
        submitted_score = next(
            (s for s in scores if s["username"] == "api-integration-test"), None
        )
        assert submitted_score is not None
        assert submitted_score["score"] == 99999
        assert submitted_score["character"] == "heather"

    def test_cors_with_localhost_origin(self):
        """Test CORS works with localhost origin"""
        localhost_headers = {
            "Content-Type": "application/json",
            "Origin": "http://localhost:5173",
        }

        response = requests.get(self.api_url, headers=localhost_headers)

        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert (
            response.headers["access-control-allow-origin"] == "http://localhost:5173"
        )

    def test_invalid_game_path(self):
        """Test request to root leaderboard path fails appropriately"""
        response = requests.get(f"{API_ENDPOINT}/leaderboard", headers=self.headers)

        # API Gateway should return 403 Forbidden for missing path parameter
        assert response.status_code in [403, 404]

    def test_score_submission_flow(self):
        """Test complete score submission and retrieval flow"""
        pytest.skip("Requires real JWT secret from Lambda environment - skipping in CI")

        # Submit a score
        token = self._create_test_token("flow-test-user")
        auth_headers = self.headers.copy()
        auth_headers["Authorization"] = f"Bearer {token}"

        timestamp = int(time.time())
        data = {
            "score": timestamp,  # Use timestamp as score for uniqueness
            "character": "puffy",
        }

        post_response = requests.post(self.api_url, json=data, headers=auth_headers)
        assert post_response.status_code == 201

        # Retrieve the leaderboard
        get_response = requests.get(self.api_url, headers=self.headers)
        assert get_response.status_code == 200

        # Verify our score is in the leaderboard
        leaderboard = get_response.json()
        scores = leaderboard["scores"]
        our_score = next(
            (
                s
                for s in scores
                if s["username"] == "flow-test-user" and s["score"] == timestamp
            ),
            None,
        )
        assert our_score is not None
        assert our_score["character"] == "puffy"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
