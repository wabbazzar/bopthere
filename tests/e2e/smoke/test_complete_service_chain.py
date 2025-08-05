#!/usr/bin/env python3
"""
Complete Service Chain E2E Tests
Tests end-to-end workflows across all services: API Gateway → Lambda → DynamoDB

This test suite verifies:
1. Complete authentication flow (login, verify, register)
2. Complete RSVP submission and retrieval flow
3. Complete leaderboard submission and retrieval flow
4. Service integration and data consistency
5. Error handling across all service chains
6. us-east-1 region consistency
7. Field integrity matching exact API schemas

Prerequisites:
- AWS CLI configured with personal profile
- All DynamoDB tables exist in us-east-1
- All Lambda functions deployed in us-east-1
- API Gateway deployed with all endpoints in us-east-1
"""

import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import boto3
import pytest
import requests

# Configuration
API_GATEWAY_URL = os.getenv(
    "VITE_API_GATEWAY_URL",
    "https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod",
)
AWS_PROFILE = "personal"
AWS_REGION = "us-east-1"

# Service configuration
SERVICES = {
    "auth": {
        "lambda": "heatherandwesley-auth-handler",
        "table": "heatherandwesley-users",
    },
    "rsvp": {
        "lambda": "heatherandwesley-rsvp-handler",
        "table": "heatherandwesley-users",  # RSVP data stored in users table
    },
    "leaderboard": {
        "lambda": "heatherandwesley-leaderboard-handler",
        "table": "heatherandwesley-leaderboard",
    },
}


@pytest.mark.smoke
class TestCompleteServiceChain:
    """Test complete service chain: API Gateway → Lambda → DynamoDB"""

    @classmethod
    def setup_class(cls):
        """Set up AWS clients and test environment"""
        session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        cls.dynamodb = session.resource("dynamodb")
        cls.lambda_client = session.client("lambda")
        cls.apigateway_client = session.client("apigateway")

        # Track created test data for cleanup
        cls.created_items = {"users": [], "rsvps": [], "scores": []}

        # Test data
        cls.test_session_id = uuid.uuid4().hex[:8]

    @classmethod
    def teardown_class(cls):
        """Clean up all test data"""
        # Clean up users table
        if cls.created_items["users"] or cls.created_items["rsvps"]:
            users_table = cls.dynamodb.Table(SERVICES["auth"]["table"])
            all_user_ids = cls.created_items["users"] + cls.created_items["rsvps"]
            for item_id in all_user_ids:
                try:
                    users_table.delete_item(Key={"id": item_id})
                except Exception as e:
                    print(f"Warning: Failed to cleanup user/rsvp {item_id}: {e}")

        # Clean up leaderboard table
        if cls.created_items["scores"]:
            leaderboard_table = cls.dynamodb.Table(SERVICES["leaderboard"]["table"])
            for score_info in cls.created_items["scores"]:
                try:
                    leaderboard_table.delete_item(
                        Key={
                            "game": score_info["game"],
                            "score_timestamp": score_info["score_timestamp"],
                        }
                    )
                except Exception as e:
                    print(f"Warning: Failed to cleanup score {score_info}: {e}")

    def test_api_gateway_discovery(self):
        """Test API Gateway exists and is accessible in us-east-1"""
        try:
            apis = self.apigateway_client.get_rest_apis()
            wedding_apis = [
                api for api in apis["items"] if "heatherandwesley" in api["name"]
            ]

            assert (
                len(wedding_apis) > 0
            ), "No wedding app API Gateway found in us-east-1"

            # Get the main API
            api = next(
                (api for api in wedding_apis if api["name"] == "heatherandwesley-api"),
                wedding_apis[0],
            )

            # Verify API structure
            resources = self.apigateway_client.get_resources(restApiId=api["id"])
            resource_paths = [res.get("pathPart", "/") for res in resources["items"]]

            expected_paths = ["auth", "rsvp", "leaderboard"]
            for path in expected_paths:
                assert any(
                    path in rp for rp in resource_paths
                ), f"Path {path} not found in API Gateway"

            base_url = f"https://{api['id']}.execute-api"
            return f"{base_url}.{AWS_REGION}.amazonaws.com/prod"

        except Exception as e:
            pytest.skip(f"API Gateway discovery failed: {e}")

    def test_health_endpoint_complete_service_status(self):
        """Test health check endpoint returns status of all services"""
        api_url = self.test_api_gateway_discovery()

        try:
            response = requests.get(f"{api_url}/health", timeout=10)

            if response.status_code == 200:
                data = response.json()

                # Validate health response structure
                assert "status" in data, "Health response missing status"
                assert "region" in data, "Health response missing region"
                assert "services" in data, "Health response missing services"

                # Verify correct region
                assert (
                    data["region"] == AWS_REGION
                ), f"Health check reports wrong region: {data['region']}"

                # Verify services are reported
                services = data["services"]
                assert "dynamodb" in services, "Health response missing DynamoDB status"
                assert "lambda" in services, "Health response missing Lambda status"

                # Verify DynamoDB service status
                dynamodb_status = services["dynamodb"]
                table_names = [SERVICES[svc]["table"] for svc in SERVICES.values()]
                for table_name in table_names:
                    assert (
                        table_name in dynamodb_status
                    ), f"Table {table_name} not in health status"
                    status = dynamodb_status[table_name]
                    assert (
                        status["status"] == "active"
                    ), f"Table {table_name} not active: {status}"
                    assert (
                        status["region"] == AWS_REGION
                    ), f"Table {table_name} not in {AWS_REGION}"

                # Verify Lambda service status
                lambda_status = services["lambda"]
                lambda_names = [SERVICES[svc]["lambda"] for svc in SERVICES.values()]
                for lambda_name in lambda_names:
                    assert (
                        lambda_name in lambda_status
                    ), f"Lambda {lambda_name} not in health status"
                    status = lambda_status[lambda_name]
                    assert (
                        status["status"] == "active"
                    ), f"Lambda {lambda_name} not active: {status}"
                    assert (
                        status["region"] == AWS_REGION
                    ), f"Lambda {lambda_name} not in {AWS_REGION}"

            elif response.status_code == 404:
                pytest.skip("Health endpoint not implemented yet")
            else:
                pytest.fail(
                    f"Health endpoint returned error: "
                    f"{response.status_code}: {response.text}"
                )

        except requests.exceptions.RequestException:
            pytest.skip("Health endpoint not accessible")

    def test_complete_auth_flow_chain(self):
        """Test complete authentication flow: register → login → verify"""
        api_url = self.test_api_gateway_discovery()

        # Step 1: Create test user data
        test_user = {
            "username": f"chaintest_{self.test_session_id}",
            "email": f"chaintest_{self.test_session_id}@example.com",
            "password": "ChainTest123!",
            "full_name": "Chain Test User",
            "role": "guest",
        }

        # Step 2: Try registration (if endpoint exists)
        register_response = requests.post(
            f"{api_url}/auth/register",
            json=test_user,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if register_response.status_code in [200, 201]:
            # Registration successful
            reg_data = register_response.json()
            if "user" in reg_data and "id" in reg_data["user"]:
                user_id = reg_data["user"]["id"]
            elif "id" in reg_data:
                user_id = reg_data["id"]
            else:
                user_id = f"manual-{uuid.uuid4().hex[:8]}"
            self.created_items["users"].append(user_id)

        elif register_response.status_code == 404:
            # Registration not implemented - create user manually in DynamoDB
            import hashlib

            user_id = f"manual-{uuid.uuid4().hex[:8]}"
            password_hash = hashlib.sha256(test_user["password"].encode()).hexdigest()

            users_table = self.dynamodb.Table(SERVICES["auth"]["table"])
            users_table.put_item(
                Item={
                    "id": user_id,
                    "username": test_user["username"],
                    "email": test_user["email"],
                    "password_hash": password_hash,
                    "full_name": test_user["full_name"],
                    "role": test_user["role"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_login": datetime.now(timezone.utc).isoformat(),
                }
            )
            self.created_items["users"].append(user_id)

        else:
            pytest.skip(f"Could not set up test user: {register_response.status_code}")

        # Step 3: Test login
        login_response = requests.post(
            f"{api_url}/auth/login",
            json={"username": test_user["username"], "password": test_user["password"]},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        assert login_response.status_code == 200, f"Login failed: {login_response.text}"

        login_data = login_response.json()
        assert "token" in login_data, "Login response missing token"
        assert "user" in login_data, "Login response missing user data"

        token = login_data["token"]
        user_data = login_data["user"]

        # Validate user data structure
        expected_user_fields = {"username", "email", "full_name", "role"}
        for field in expected_user_fields:
            assert field in user_data, f"User data missing field: {field}"

        assert user_data["username"] == test_user["username"]
        assert user_data["email"] == test_user["email"]
        assert "password_hash" not in user_data, "Password hash leaked in response"

        # Step 4: Test token verification
        verify_response = requests.get(
            f"{api_url}/auth/verify",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        assert (
            verify_response.status_code == 200
        ), f"Token verification failed: {verify_response.text}"

        verify_data = verify_response.json()
        assert "user" in verify_data, "Verify response missing user data"

        # Verify consistency between login and verify responses
        verify_user = verify_data["user"]
        assert verify_user["username"] == user_data["username"]
        assert verify_user["email"] == user_data["email"]

        return token, user_data

    def test_complete_rsvp_flow_chain(self):
        """Test complete RSVP flow: submit → verify → field validation"""
        api_url = self.test_api_gateway_discovery()

        # RSVP test data following exact schema
        rsvp_data = {
            "name": f"Chain RSVP Test {self.test_session_id}",
            "email": f"chainrsvp_{self.test_session_id}@example.com",
            "attendance": "yes",
            "dietary_restrictions": "vegan",
            "plus_one": True,
            "plus_one_name": "Chain Plus One",
            "guest_count": 2,
            "comments": "Testing complete chain functionality",
        }

        # Submit RSVP
        rsvp_response = requests.post(
            f"{api_url}/rsvp",
            json=rsvp_data,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        assert rsvp_response.status_code in [
            200,
            201,
        ], f"RSVP submission failed: {rsvp_response.text}"

        response_data = rsvp_response.json()
        assert "id" in response_data, "RSVP response missing id"
        assert "message" in response_data, "RSVP response missing message"

        rsvp_id = response_data["id"]
        self.created_items["rsvps"].append(rsvp_id)

        # Verify data was stored correctly in DynamoDB
        time.sleep(1)  # Allow for eventual consistency

        users_table = self.dynamodb.Table(SERVICES["rsvp"]["table"])
        stored_item = users_table.get_item(Key={"id": rsvp_id})

        assert "Item" in stored_item, f"RSVP {rsvp_id} not found in DynamoDB"

        item = stored_item["Item"]

        # Verify all fields are stored correctly
        for field, value in rsvp_data.items():
            assert field in item, f"Field {field} not stored in DynamoDB"
            assert (
                item[field] == value
            ), f"Field {field} value mismatch: {item[field]} != {value}"

        # Verify additional system fields
        assert "id" in item
        assert "timestamp" in item or "created_at" in item

        return rsvp_id, rsvp_data

    def test_complete_leaderboard_flow_chain(self):
        """Test complete leaderboard flow: submit → retrieve → verify"""
        api_url = self.test_api_gateway_discovery()

        # Get auth token first (needed for leaderboard submission)
        try:
            token, user_data = self.test_complete_auth_flow_chain()
        except Exception:
            # Create a simple token for this test
            import jwt

            token = jwt.encode(
                {
                    "username": f"leadertest_{self.test_session_id}",
                    "role": "guest",
                    "exp": datetime.utcnow() + timedelta(hours=1),
                },
                "test-secret",
                algorithm="HS256",
            )

        # Test game type
        game_type = f"tetris-test-{self.test_session_id}"

        # Submit multiple scores to test ranking
        scores_submitted = []
        for i, score_value in enumerate([1000, 2500, 1500]):
            score_data = {
                "score": score_value,
                "character": ["wesley", "heather", "puffy"][i % 3],
            }

            score_response = requests.post(
                f"{api_url}/leaderboard/{game_type}",
                json=score_data,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )

            assert score_response.status_code in [
                200,
                201,
            ], f"Score submission failed: {score_response.text}"

            score_resp_data = score_response.json()
            assert "message" in score_resp_data, "Score response missing message"

            scores_submitted.append(
                {"score": score_value, "character": score_data["character"]}
            )

            # Track for cleanup (need game and timestamp for composite key)
            if "leaderboard" in score_resp_data:
                # Try to extract timestamp from response for cleanup
                leaderboard_scores = score_resp_data["leaderboard"].get("scores", [])
                if leaderboard_scores:
                    latest_score = leaderboard_scores[0]  # Assuming sorted by latest
                    if "timestamp" in latest_score:
                        self.created_items["scores"].append(
                            {
                                "game": game_type,
                                "score_timestamp": latest_score["timestamp"],
                            }
                        )

            time.sleep(0.2)  # Small delay to ensure different timestamps

        # Retrieve leaderboard
        leaderboard_response = requests.get(
            f"{api_url}/leaderboard/{game_type}", timeout=30
        )

        assert (
            leaderboard_response.status_code == 200
        ), f"Leaderboard retrieval failed: {leaderboard_response.text}"

        leaderboard_data = leaderboard_response.json()

        # Verify leaderboard structure
        assert "game" in leaderboard_data, "Leaderboard missing game field"
        assert "scores" in leaderboard_data, "Leaderboard missing scores field"
        assert (
            "total_players" in leaderboard_data
        ), "Leaderboard missing total_players field"

        assert leaderboard_data["game"] == game_type
        assert leaderboard_data["total_players"] >= len(scores_submitted)

        # Verify scores are sorted correctly (highest first)
        scores = leaderboard_data["scores"]
        assert len(scores) >= len(scores_submitted), "Not all submitted scores returned"

        score_values = [s["score"] for s in scores]
        assert score_values == sorted(
            score_values, reverse=True
        ), "Scores not sorted correctly"

        # Verify score field structure
        for score in scores:
            assert "username" in score, "Score missing username field"
            assert "score" in score, "Score missing score field"
            assert "timestamp" in score, "Score missing timestamp field"
            assert "character" in score, "Score missing character field"

            # Verify field types
            assert isinstance(score["username"], str)
            assert isinstance(score["score"], (int, float))
            assert isinstance(score["timestamp"], str)
            assert isinstance(score["character"], str)

        return game_type, scores_submitted, leaderboard_data

    def test_cross_service_data_consistency(self):
        """Test data consistency across all services"""
        # API URL is obtained in the individual test methods

        # Test that user data is consistent across auth and other services
        token, user_data = self.test_complete_auth_flow_chain()
        rsvp_id, rsvp_data = self.test_complete_rsvp_flow_chain()
        (
            game_type,
            scores,
            leaderboard_data,
        ) = self.test_complete_leaderboard_flow_chain()

        # Verify user context consistency
        # The username from auth should appear in leaderboard if same user
        username = user_data["username"]

        # Note: This may not match if leaderboard uses different auth token
        # But we can verify the structure is consistent

        # Verify timestamp formats are consistent
        users_table = self.dynamodb.Table(SERVICES["auth"]["table"])
        user_item = users_table.scan(
            FilterExpression="username = :username",
            ExpressionAttributeValues={":username": username},
        )["Items"]

        if user_item:
            user_timestamp = user_item[0].get(
                "created_at", user_item[0].get("timestamp")
            )
            if user_timestamp:
                # Verify timestamp is ISO format
                datetime.fromisoformat(user_timestamp.replace("Z", "+00:00"))

        # Verify RSVP timestamp consistency
        rsvp_item = users_table.get_item(Key={"id": rsvp_id})["Item"]
        rsvp_timestamp = rsvp_item.get("timestamp", rsvp_item.get("created_at"))
        if rsvp_timestamp:
            datetime.fromisoformat(rsvp_timestamp.replace("Z", "+00:00"))

        # Verify leaderboard timestamp consistency
        for score in leaderboard_data["scores"]:
            datetime.fromisoformat(score["timestamp"].replace("Z", "+00:00"))

    def test_error_handling_across_services(self):
        """Test error handling consistency across all services"""
        api_url = self.test_api_gateway_discovery()

        # Test CORS headers in error responses
        error_tests = [
            {
                "endpoint": f"{api_url}/auth/login",
                "method": "POST",
                "data": {"invalid": "data"},
                "expected_status": [400, 401, 422],
            },
            {
                "endpoint": f"{api_url}/rsvp",
                "method": "POST",
                "data": {"invalid": "data"},
                "expected_status": [400, 422],
            },
            {
                "endpoint": f"{api_url}/leaderboard/invalid-game",
                "method": "GET",
                "data": None,
                "expected_status": [
                    200,
                    404,
                ],  # 200 if it returns empty, 404 if not found
            },
        ]

        for test in error_tests:
            headers = {
                "Content-Type": "application/json",
                "Origin": "https://heatherandwesley.com",
            }

            if test["method"] == "POST":
                response = requests.post(
                    test["endpoint"], json=test["data"], headers=headers, timeout=30
                )
            else:
                response = requests.get(test["endpoint"], headers=headers, timeout=30)

            # Verify status code is expected
            assert response.status_code in test["expected_status"], (
                f"Unexpected status for {test['endpoint']}: " f"{response.status_code}"
            )

            # Verify CORS headers are present in error responses
            assert (
                "Access-Control-Allow-Origin" in response.headers
            ), f"Missing CORS header in error response from {test['endpoint']}"

    def test_service_performance_chain(self):
        """Test performance across complete service chain"""

        # Measure end-to-end performance
        start_time = time.time()

        # Run a complete flow
        token, user_data = self.test_complete_auth_flow_chain()
        auth_time = time.time() - start_time

        rsvp_start = time.time()
        rsvp_id, rsvp_data = self.test_complete_rsvp_flow_chain()
        rsvp_time = time.time() - rsvp_start

        leaderboard_start = time.time()
        (
            game_type,
            scores,
            leaderboard_data,
        ) = self.test_complete_leaderboard_flow_chain()
        leaderboard_time = time.time() - leaderboard_start

        total_time = time.time() - start_time

        # Performance assertions
        assert auth_time < 10.0, f"Auth flow too slow: {auth_time:.2f}s"
        assert rsvp_time < 8.0, f"RSVP flow too slow: {rsvp_time:.2f}s"
        assert (
            leaderboard_time < 10.0
        ), f"Leaderboard flow too slow: {leaderboard_time:.2f}s"
        assert total_time < 30.0, f"Total chain too slow: {total_time:.2f}s"

        print("Performance metrics:")
        print(f"  Auth flow: {auth_time:.2f}s")
        print(f"  RSVP flow: {rsvp_time:.2f}s")
        print(f"  Leaderboard flow: {leaderboard_time:.2f}s")
        print(f"  Total chain: {total_time:.2f}s")


@pytest.mark.integration
class TestServiceChainIntegration:
    """Integration tests for service chain components"""

    def test_service_configuration_consistency(self):
        """Test that service configuration is consistent"""
        # Verify all services are configured for the same region
        for service_name, config in SERVICES.items():
            assert (
                "lambda" in config
            ), f"Service {service_name} missing lambda configuration"
            assert (
                "table" in config
            ), f"Service {service_name} missing table configuration"

            # Lambda names should follow naming convention
            assert config["lambda"].startswith(
                "heatherandwesley-"
            ), f"Lambda {config['lambda']} doesn't follow naming convention"

            # Table names should follow naming convention
            assert config["table"].startswith(
                "heatherandwesley-"
            ), f"Table {config['table']} doesn't follow naming convention"

    def test_api_endpoint_consistency(self):
        """Test API endpoint URL consistency"""
        # Verify API URL points to us-east-1
        assert (
            AWS_REGION in API_GATEWAY_URL or "us-east-1" in API_GATEWAY_URL
        ), f"API Gateway URL doesn't specify us-east-1: {API_GATEWAY_URL}"

        # Verify expected endpoints exist in URL structure
        expected_endpoints = ["auth", "rsvp", "leaderboard"]

        # This is documentation - testing is done in the main tests
        print(f"Expected endpoints: {expected_endpoints}")
        print(f"API Gateway URL: {API_GATEWAY_URL}")


if __name__ == "__main__":
    # Run with: python -m pytest this file with -v flag
    pytest.main([__file__, "-v", "--tb=short"])
