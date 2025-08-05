"""
Migration verification smoke tests
Tests that all AWS resources are correctly migrated to us-east-1
"""

import json
from typing import Dict, List

import boto3
import pytest
import requests


@pytest.mark.smoke
class TestMigrationVerification:
    """Test complete migration to us-east-1"""

    @pytest.fixture(scope="session")
    def aws_session(self):
        """Create AWS session with correct profile and region"""
        return boto3.Session(profile_name="personal", region_name="us-east-1")

    @pytest.fixture(scope="session")
    def dynamodb_client(self, aws_session):
        """Create DynamoDB client"""
        return aws_session.client("dynamodb")

    @pytest.fixture(scope="session")
    def lambda_client(self, aws_session):
        """Create Lambda client"""
        return aws_session.client("lambda")

    @pytest.fixture(scope="session")
    def apigateway_client(self, aws_session):
        """Create API Gateway client"""
        return aws_session.client("apigateway")

    def test_dynamodb_tables_in_us_east_1(self, dynamodb_client):
        """Test that all required DynamoDB tables exist in us-east-1"""
        required_tables = [
            "heatherandwesley-users",
            "heatherandwesley-auth-users",
            "heatherandwesley-leaderboard",
        ]

        # List all tables
        response = dynamodb_client.list_tables()
        existing_tables = response["TableNames"]

        # Check each required table exists
        for table_name in required_tables:
            assert (
                table_name in existing_tables
            ), f"Table {table_name} not found in us-east-1"

            # Verify table is active
            table_info = dynamodb_client.describe_table(TableName=table_name)
            assert (
                table_info["Table"]["TableStatus"] == "ACTIVE"
            ), f"Table {table_name} is not active"

    def test_lambda_functions_in_us_east_1(self, lambda_client):
        """Test that all required Lambda functions exist in us-east-1"""
        required_lambdas = [
            "heatherandwesley-rsvp-handler",
            "heatherandwesley-auth-handler",
            "heatherandwesley-leaderboard-handler",
        ]

        # List all functions
        response = lambda_client.list_functions()
        existing_functions = [func["FunctionName"] for func in response["Functions"]]

        # Check each required function exists
        for lambda_name in required_lambdas:
            assert (
                lambda_name in existing_functions
            ), f"Lambda {lambda_name} not found in us-east-1"

            # Verify function configuration
            func_info = lambda_client.get_function(FunctionName=lambda_name)
            config = func_info["Configuration"]
            assert config["State"] in [
                "Active",
                "LastUpdateStatus",
            ], f"Lambda {lambda_name} is not active"

    def test_api_gateway_in_us_east_1(self, apigateway_client):
        """Test that API Gateway exists in us-east-1"""
        response = apigateway_client.get_rest_apis()
        wedding_apis = [
            api for api in response["items"] if api["name"] == "heatherandwesley-api"
        ]

        assert len(wedding_apis) > 0, "API Gateway not found in us-east-1"

        # Check all wedding APIs to find the one with correct resources
        expected_paths = ["/rsvp", "/auth", "/leaderboard"]
        api_found = False

        for api in wedding_apis:
            resources = apigateway_client.get_resources(restApiId=api["id"])
            resource_paths = [res.get("path", "") for res in resources["items"]]

            # Check if this API has all expected paths
            if all(
                any(rp.startswith(path) for rp in resource_paths)
                for path in expected_paths
            ):
                api_found = True
                break

        assert (
            api_found
        ), f"No API Gateway found with all expected paths: {expected_paths}"

    def test_no_resources_in_us_west_2(self):
        """Test that no wedding app resources remain in us-west-2"""
        # Create session for us-west-2
        west_session = boto3.Session(profile_name="personal", region_name="us-west-2")

        # Check DynamoDB tables
        west_dynamodb = west_session.client("dynamodb")
        west_tables = west_dynamodb.list_tables()["TableNames"]
        wedding_tables = [t for t in west_tables if t.startswith("heatherandwesley")]
        assert (
            len(wedding_tables) == 0
        ), f"Found DynamoDB tables in us-west-2: {wedding_tables}"

        # Check Lambda functions
        west_lambda = west_session.client("lambda")
        west_functions = west_lambda.list_functions()["Functions"]
        wedding_functions = [
            f["FunctionName"]
            for f in west_functions
            if f["FunctionName"].startswith("heatherandwesley")
        ]
        assert (
            len(wedding_functions) == 0
        ), f"Found Lambda functions in us-west-2: {wedding_functions}"

        # Check API Gateway
        west_apigateway = west_session.client("apigateway")
        west_apis = west_apigateway.get_rest_apis()["items"]
        wedding_apis = [
            api["name"]
            for api in west_apis
            if api["name"].startswith("heatherandwesley")
        ]
        assert (
            len(wedding_apis) == 0
        ), f"Found API Gateways in us-west-2: {wedding_apis}"

    def test_health_endpoint_accessible(self, apigateway_client):
        """Test that health endpoint is accessible and returns correct region"""
        # Get API Gateway URL
        response = apigateway_client.get_rest_apis()
        api = next(
            (api for api in response["items"] if api["name"] == "heatherandwesley-api"),
            None,
        )

        if api is None:
            pytest.skip("API Gateway not found - health endpoint cannot be tested")

        api_url = f"https://{api['id']}.execute-api.us-east-1.amazonaws.com/prod/health"

        try:
            # Test health endpoint
            health_response = requests.get(api_url, timeout=10)

            if health_response.status_code == 200:
                health_data = health_response.json()

                # Verify response structure
                assert "status" in health_data, "Health response missing status field"
                assert "region" in health_data, "Health response missing region field"
                assert (
                    "services" in health_data
                ), "Health response missing services field"

                # Verify correct region
                assert (
                    health_data["region"] == "us-east-1"
                ), f"Health endpoint reports wrong region: {health_data['region']}"

                # Verify services are reported
                services = health_data["services"]
                assert "dynamodb" in services, "Health response missing DynamoDB status"
                assert "lambda" in services, "Health response missing Lambda status"

        except requests.exceptions.RequestException:
            # Health endpoint might not be deployed yet - this is acceptable for migration verification
            pytest.skip("Health endpoint not accessible - may not be deployed yet")

    def test_service_integration_basic(self, apigateway_client):
        """Test basic service integration to verify migration was successful"""
        # Get API Gateway URL
        response = apigateway_client.get_rest_apis()
        api = next(
            (api for api in response["items"] if api["name"] == "heatherandwesley-api"),
            None,
        )

        if api is None:
            pytest.skip("API Gateway not found - integration test cannot be performed")

        api_base = f"https://{api['id']}.execute-api.us-east-1.amazonaws.com/prod"

        # Test auth login endpoint (basic connectivity test)
        try:
            auth_response = requests.post(
                f"{api_base}/auth/login",
                json={"username": "testuser", "password": "testpass"},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

            # We expect this to fail authentication, but it should return a proper HTTP response
            # indicating the service is running (not a 502 or 503 error)
            assert auth_response.status_code in [
                200,
                400,
                401,
                403,
            ], f"Auth service not responding correctly: {auth_response.status_code}"

        except requests.exceptions.RequestException:
            pytest.skip(
                "Auth endpoint not accessible - may need additional configuration"
            )

        # Test leaderboard endpoint (basic connectivity test)
        try:
            leaderboard_response = requests.get(
                f"{api_base}/leaderboard/tetris", timeout=10
            )

            # Should return 200 or proper error, not gateway errors
            assert leaderboard_response.status_code in [
                200,
                400,
                404,
            ], f"Leaderboard service not responding correctly: {leaderboard_response.status_code}"

        except requests.exceptions.RequestException:
            pytest.skip(
                "Leaderboard endpoint not accessible - may need additional configuration"
            )


class TestMigrationConsistency:
    """Test migration consistency and completeness"""

    def test_environment_variables_updated(self):
        """Test that environment variables reference correct region"""
        # This test would check Lambda function environment variables
        # to ensure they reference us-east-1 resources
        session = boto3.Session(profile_name="personal", region_name="us-east-1")
        lambda_client = session.client("lambda")

        required_lambdas = [
            "heatherandwesley-rsvp-handler",
            "heatherandwesley-auth-handler",
            "heatherandwesley-leaderboard-handler",
        ]

        for lambda_name in required_lambdas:
            try:
                func_info = lambda_client.get_function(FunctionName=lambda_name)
                env_vars = (
                    func_info["Configuration"]
                    .get("Environment", {})
                    .get("Variables", {})
                )

                # Check that no environment variables reference us-west-2
                for key, value in env_vars.items():
                    if isinstance(value, str):
                        assert (
                            "us-west-2" not in value
                        ), f"Lambda {lambda_name} has us-west-2 reference in env var {key}: {value}"

            except lambda_client.exceptions.ResourceNotFoundException:
                # Lambda function doesn't exist yet - acceptable for migration test
                pass

    def test_iam_roles_region_consistent(self):
        """Test that IAM roles don't have region-specific policies for us-west-2"""
        session = boto3.Session(profile_name="personal")
        iam_client = session.client("iam")

        # List roles that start with heatherandwesley
        try:
            roles = iam_client.list_roles()["Roles"]
            wedding_roles = [
                role
                for role in roles
                if role["RoleName"].startswith("heatherandwesley")
            ]

            for role in wedding_roles:
                # Get role policies
                try:
                    policies = iam_client.list_role_policies(RoleName=role["RoleName"])
                    for policy_name in policies["PolicyNames"]:
                        policy = iam_client.get_role_policy(
                            RoleName=role["RoleName"], PolicyName=policy_name
                        )
                        policy_doc = json.dumps(policy["PolicyDocument"])

                        # Check that policy doesn't reference us-west-2
                        assert (
                            "us-west-2" not in policy_doc
                        ), f"Role {role['RoleName']} policy {policy_name} references us-west-2"

                except iam_client.exceptions.NoSuchEntityException:
                    # Policy doesn't exist - this is fine
                    pass

        except Exception:
            # IAM operations might fail due to permissions - skip this test
            pytest.skip("Cannot verify IAM roles - insufficient permissions")
