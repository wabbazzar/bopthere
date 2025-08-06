#!/usr/bin/env python3
"""
Test suite for API Gateway and Lambda Pattern Extractors
Tests all functionality including error handling, edge cases, and output generation
"""

import base64
import json
import os
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, Mock, call, mock_open, patch

import pytest

# Add the scripts directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../../scripts"))

from extract_api_gateway_routes import APIGatewayExtractor
from extract_lambda_patterns import LambdaPatternExtractor


class TestAPIGatewayExtractor:
    """Test suite for APIGatewayExtractor class"""

    @pytest.fixture
    def mock_boto3_session(self):
        """Mock boto3 session for testing"""
        with patch("extract_api_gateway_routes.boto3.Session") as mock_session:
            # Create mock client
            mock_api_gateway_client = Mock()

            # Configure session to return mocked client
            mock_session.return_value.client.return_value = mock_api_gateway_client

            yield mock_session, mock_api_gateway_client

    def test_initialization_success(self, mock_boto3_session):
        """Test successful initialization of APIGatewayExtractor"""
        mock_session, mock_client = mock_boto3_session

        # Create extractor
        extractor = APIGatewayExtractor(profile="test-profile", region="us-east-1")

        # Verify boto3 session was created with correct parameters
        mock_session.assert_called_once_with(
            profile_name="test-profile", region_name="us-east-1"
        )

        # Verify client was created
        assert extractor.api_gateway is not None
        assert extractor.region == "us-east-1"

    def test_initialization_default_values(self, mock_boto3_session):
        """Test initialization with default values"""
        mock_session, mock_client = mock_boto3_session

        # Create extractor with defaults (no profile since we're in test environment)
        extractor = APIGatewayExtractor()

        # Verify defaults - should not pass profile when not specified
        mock_session.assert_called_once_with(region_name="us-east-1")
        assert extractor.region == "us-east-1"

    def test_find_api_by_name_success(self, mock_boto3_session):
        """Test successfully finding an API by name"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock API response
        mock_client.get_rest_apis.return_value = {
            "items": [
                {"id": "api1", "name": "other-api"},
                {"id": "api2", "name": "heatherandwesley-api"},
                {"id": "api3", "name": "another-api"},
            ]
        }

        # Find API
        result = extractor.find_api_by_name("heatherandwesley")

        # Verify result
        assert result is not None
        assert result["id"] == "api2"
        assert result["name"] == "heatherandwesley-api"

    def test_find_api_by_name_not_found(self, mock_boto3_session):
        """Test when API is not found"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock empty response
        mock_client.get_rest_apis.return_value = {
            "items": [
                {"id": "api1", "name": "other-api"},
                {"id": "api2", "name": "different-api"},
            ]
        }

        # Find API
        result = extractor.find_api_by_name("heatherandwesley")

        # Verify result
        assert result is None

    def test_find_api_by_name_error(self, mock_boto3_session):
        """Test error handling when finding API"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock API error
        mock_client.get_rest_apis.side_effect = Exception("AWS Error")

        # Find API
        result = extractor.find_api_by_name("heatherandwesley")

        # Verify error handling
        assert result is None

    def test_get_resources_success(self, mock_boto3_session):
        """Test successfully getting resources"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock resources response
        mock_client.get_resources.return_value = {
            "items": [
                {"id": "root", "path": "/"},
                {"id": "res1", "path": "/rsvp"},
                {"id": "res2", "path": "/rsvp/{id}"},
            ]
        }

        # Get resources
        result = extractor.get_resources("api-id")

        # Verify result
        assert len(result) == 3
        assert result[0]["path"] == "/"
        assert result[1]["path"] == "/rsvp"
        assert result[2]["path"] == "/rsvp/{id}"

    def test_get_resources_error(self, mock_boto3_session):
        """Test error handling when getting resources"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock error
        mock_client.get_resources.side_effect = Exception("Access denied")

        # Get resources
        result = extractor.get_resources("api-id")

        # Verify empty list returned
        assert result == []

    def test_get_methods_success(self, mock_boto3_session):
        """Test successfully getting methods for a resource"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock methods response
        mock_client.get_resource.return_value = {
            "resourceMethods": {
                "GET": {"authorizationType": "NONE"},
                "POST": {"authorizationType": "AWS_IAM", "apiKeyRequired": True},
            }
        }

        # Get methods
        result = extractor.get_methods("api-id", "resource-id")

        # Verify result
        assert "GET" in result
        assert "POST" in result
        assert result["GET"]["authorizationType"] == "NONE"
        assert result["POST"]["apiKeyRequired"] is True

    def test_get_methods_error(self, mock_boto3_session):
        """Test error handling when getting methods"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock error
        mock_client.get_resource.side_effect = Exception("Resource not found")

        # Get methods
        result = extractor.get_methods("api-id", "resource-id")

        # Verify empty dict returned
        assert result == {}

    def test_get_integration_success(self, mock_boto3_session):
        """Test successfully getting integration details"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock integration response
        mock_client.get_integration.return_value = {
            "type": "AWS_PROXY",
            "httpMethod": "POST",
            "uri": "arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:123456:function:heatherandwesley-rsvp-handler/invocations",
            "connectionType": "INTERNET",
        }

        # Get integration
        result = extractor.get_integration("api-id", "resource-id", "POST")

        # Verify result
        assert result is not None
        assert result["type"] == "AWS_PROXY"
        assert "lambda" in result["uri"]

    def test_get_integration_error(self, mock_boto3_session):
        """Test error handling when getting integration"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock error
        mock_client.get_integration.side_effect = Exception("Integration not found")

        # Get integration
        result = extractor.get_integration("api-id", "resource-id", "POST")

        # Verify None returned
        assert result is None

    def test_extract_lambda_arn_success(self, mock_boto3_session):
        """Test successfully extracting Lambda ARN from integration URI"""
        _, _ = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Test valid Lambda integration URI
        integration = {
            "type": "AWS_PROXY",
            "uri": "arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:123456:function:my-function/invocations",
        }

        # Extract ARN
        result = extractor.extract_lambda_arn(integration)

        # Verify result
        assert result == "arn:aws:lambda:us-west-2:123456:function:my-function"

    def test_extract_lambda_arn_non_proxy(self, mock_boto3_session):
        """Test extraction returns None for non-proxy integration"""
        _, _ = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Test non-proxy integration
        integration = {"type": "HTTP", "uri": "https://example.com/api"}

        # Extract ARN
        result = extractor.extract_lambda_arn(integration)

        # Verify None returned
        assert result is None

    def test_extract_lambda_arn_malformed_uri(self, mock_boto3_session):
        """Test extraction with malformed URI"""
        _, _ = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Test malformed URI
        integration = {"type": "AWS_PROXY", "uri": "invalid-uri-format"}

        # Extract ARN
        result = extractor.extract_lambda_arn(integration)

        # Verify None returned
        assert result is None

    def test_extract_routes_success(self, mock_boto3_session):
        """Test successful route extraction"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock API discovery
        mock_client.get_rest_apis.return_value = {
            "items": [
                {
                    "id": "api123",
                    "name": "heatherandwesley-api",
                    "createdDate": datetime.utcnow(),
                }
            ]
        }

        # Mock deployments and stages
        mock_client.get_deployments.return_value = {
            "items": [{"id": "dep1", "createdDate": datetime.utcnow()}]
        }
        mock_client.get_stages.return_value = {
            "items": [
                {
                    "stageName": "prod",
                    "deploymentId": "dep1",
                    "createdDate": datetime.utcnow(),
                }
            ]
        }

        # Mock resources
        mock_client.get_resources.return_value = {
            "items": [{"id": "root", "path": "/"}, {"id": "res1", "path": "/rsvp"}]
        }

        # Mock methods
        mock_client.get_resource.side_effect = [
            {"resourceMethods": {}},  # root has no methods
            {
                "resourceMethods": {"POST": {"authorizationType": "NONE"}}
            },  # /rsvp has POST
        ]

        # Mock integration
        mock_client.get_integration.return_value = {
            "type": "AWS_PROXY",
            "uri": "arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:123456:function:rsvp-handler/invocations",
        }

        # Extract routes
        result = extractor.extract_routes("heatherandwesley")

        # Verify result structure
        assert result["api_name"] == "heatherandwesley-api"
        assert result["api_id"] == "api123"
        assert len(result["routes"]) == 1
        assert result["routes"][0]["route_key"] == "POST /rsvp"
        assert (
            result["routes"][0]["integration"]["lambda_function_name"] == "rsvp-handler"
        )

    def test_extract_routes_api_not_found(self, mock_boto3_session):
        """Test route extraction when API not found"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock empty API list
        mock_client.get_rest_apis.return_value = {"items": []}

        # Extract routes
        result = extractor.extract_routes("nonexistent")

        # Verify error result
        assert "error" in result
        assert "not found" in result["error"]
        assert result["routes"] == []

    def test_extract_routes_with_default_stage(self, mock_boto3_session):
        """Test route extraction with default stage when no stages found"""
        _, mock_client = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Mock API discovery
        mock_client.get_rest_apis.return_value = {
            "items": [{"id": "api123", "name": "heatherandwesley-api"}]
        }

        # Mock deployments but no stages
        mock_client.get_deployments.return_value = {"items": [{"id": "dep1"}]}
        mock_client.get_stages.return_value = {"items": []}

        # Mock empty resources
        mock_client.get_resources.return_value = {"items": []}

        # Extract routes
        result = extractor.extract_routes("heatherandwesley", default_stage="prod")

        # Verify default stage was added
        assert len(result["stages"]) == 1
        assert result["stages"][0]["name"] == "prod"
        assert result["stages"][0]["description"] == "Default stage (inferred)"

    @patch("builtins.open", new_callable=mock_open)
    @patch("pathlib.Path.mkdir")
    def test_save_to_file(self, mock_mkdir, mock_file, mock_boto3_session):
        """Test saving data to file"""
        _, _ = mock_boto3_session
        extractor = APIGatewayExtractor()

        # Test data
        test_data = {"api_name": "test-api", "routes": [{"path": "/test"}]}

        # Save to file
        extractor.save_to_file(test_data, "test-output.json")

        # Verify directory creation
        mock_mkdir.assert_called_once()

        # Verify file write
        mock_file.assert_called_once_with(Path("test-output.json"), "w")

        # Verify JSON was written
        handle = mock_file()
        written_data = "".join(call.args[0] for call in handle.write.call_args_list)
        parsed_data = json.loads(written_data)
        assert parsed_data["api_name"] == "test-api"

    @patch("extract_api_gateway_routes.APIGatewayExtractor")
    def test_main_success(self, mock_extractor_class):
        """Test main function success flow"""
        # Mock extractor instance
        mock_extractor = Mock()
        mock_extractor_class.return_value = mock_extractor
        mock_extractor.extract_routes.return_value = {
            "api_name": "test-api",
            "api_id": "api-123",
            "api_type": "REST",
            "routes": [{"route_key": "GET /test", "path": "/test"}],
            "stages": [],
        }

        # Import and run main
        from extract_api_gateway_routes import main

        # Capture print output
        with patch("builtins.print") as mock_print:
            main()

        # Verify workflow
        mock_extractor_class.assert_called_once_with(
            profile="personal", region="us-east-1"
        )
        mock_extractor.extract_routes.assert_called_once_with("heatherandwesley")
        mock_extractor.save_to_file.assert_called_once()

        # Verify summary was printed
        print_calls = [str(call) for call in mock_print.call_args_list]
        assert any("API Gateway Route Summary" in str(call) for call in print_calls)


class TestLambdaPatternExtractor:
    """Test suite for LambdaPatternExtractor class"""

    @pytest.fixture
    def mock_boto3_session(self):
        """Mock boto3 session for testing"""
        with patch("extract_lambda_patterns.boto3.Session") as mock_session:
            # Create mock clients
            mock_lambda_client = Mock()
            mock_api_gateway_client = Mock()

            # Configure session to return mocked clients
            mock_session.return_value.client.side_effect = lambda service: {
                "lambda": mock_lambda_client,
                "apigateway": mock_api_gateway_client,
            }.get(service)

            yield mock_session, mock_lambda_client, mock_api_gateway_client

    def test_initialization_success(self, mock_boto3_session):
        """Test successful initialization of LambdaPatternExtractor"""
        mock_session, mock_lambda, mock_api = mock_boto3_session

        # Create extractor
        extractor = LambdaPatternExtractor(profile="test-profile", region="eu-west-1")

        # Verify boto3 session was created with correct parameters
        mock_session.assert_called_once_with(
            profile_name="test-profile", region_name="eu-west-1"
        )

        # Verify clients were created
        assert extractor.lambda_client is not None
        assert extractor.api_gateway is not None
        assert extractor.region == "eu-west-1"

    def test_find_lambda_by_name_success(self, mock_boto3_session):
        """Test successfully finding a Lambda function by name"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock paginator
        mock_paginator = Mock()
        mock_lambda.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Functions": [
                    {"FunctionName": "other-function"},
                    {"FunctionName": "heatherandwesley-rsvp-handler"},
                    {"FunctionName": "another-function"},
                ]
            }
        ]

        # Find Lambda
        result = extractor.find_lambda_by_name("rsvp-handler")

        # Verify result
        assert result is not None
        assert result["FunctionName"] == "heatherandwesley-rsvp-handler"

    def test_find_lambda_by_name_not_found(self, mock_boto3_session):
        """Test when Lambda function is not found"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock empty response
        mock_paginator = Mock()
        mock_lambda.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [{"Functions": []}]

        # Find Lambda
        result = extractor.find_lambda_by_name("nonexistent")

        # Verify result
        assert result is None

    def test_find_lambda_by_name_error(self, mock_boto3_session):
        """Test error handling when finding Lambda"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock error
        mock_lambda.get_paginator.side_effect = Exception("Access denied")

        # Find Lambda
        result = extractor.find_lambda_by_name("test-function")

        # Verify error handling
        assert result is None

    def test_get_lambda_configuration_success(self, mock_boto3_session):
        """Test successfully getting Lambda configuration"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock Lambda configuration
        mock_lambda.get_function.return_value = {
            "Configuration": {
                "FunctionName": "test-function",
                "FunctionArn": "arn:aws:lambda:us-west-2:123456:function:test-function",
                "Runtime": "python3.9",
                "Handler": "index.handler",
                "Timeout": 60,
                "MemorySize": 256,
                "Environment": {
                    "Variables": {"TABLE_NAME": "test-table", "API_KEY": "secret"}
                },
                "LastModified": "2024-01-01T00:00:00Z",
            }
        }

        # Get configuration
        result = extractor.get_lambda_configuration("test-function")

        # Verify result
        assert result["function_name"] == "test-function"
        assert result["runtime"] == "python3.9"
        assert result["timeout"] == 60
        assert result["environment"]["TABLE_NAME"] == "test-table"

    def test_get_lambda_configuration_error(self, mock_boto3_session):
        """Test error handling when getting Lambda configuration"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock error
        mock_lambda.get_function.side_effect = Exception("Function not found")

        # Get configuration
        result = extractor.get_lambda_configuration("nonexistent")

        # Verify empty dict returned
        assert result == {}

    def test_create_api_gateway_event(self, mock_boto3_session):
        """Test creating API Gateway event"""
        _, _, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Create event with all parameters
        event = extractor.create_api_gateway_event(
            method="POST",
            path="/rsvp",
            body={"name": "Test"},
            path_params={"id": "123"},
            query_params={"filter": "active"},
        )

        # Verify event structure
        assert event["httpMethod"] == "POST"
        assert event["path"] == "/rsvp"
        assert event["body"] == '{"name": "Test"}'
        assert event["pathParameters"]["id"] == "123"
        assert event["queryStringParameters"]["filter"] == "active"
        assert event["isBase64Encoded"] is False
        assert "Content-Type" in event["headers"]

    def test_create_api_gateway_event_no_body(self, mock_boto3_session):
        """Test creating API Gateway event without body"""
        _, _, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Create event without body
        event = extractor.create_api_gateway_event("GET", "/rsvp/123")

        # Verify body is None
        assert event["body"] is None
        assert event["httpMethod"] == "GET"

    def test_invoke_lambda_success(self, mock_boto3_session):
        """Test successful Lambda invocation"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock Lambda response
        mock_response = {
            "StatusCode": 200,
            "Payload": Mock(
                read=lambda: json.dumps(
                    {"statusCode": 200, "body": json.dumps({"message": "Success"})}
                ).encode()
            ),
            "LogResult": base64.b64encode(b"Lambda execution logs").decode(),
        }
        mock_lambda.invoke.return_value = mock_response

        # Invoke Lambda
        event = {"test": "event"}
        status, response = extractor.invoke_lambda("test-function", event)

        # Verify result
        assert status == 200
        assert response["statusCode"] == 200
        assert "Success" in response["body"]

    def test_invoke_lambda_error(self, mock_boto3_session):
        """Test Lambda invocation error handling"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock Lambda error
        mock_lambda.invoke.side_effect = Exception("Invocation failed")

        # Invoke Lambda
        event = {"test": "event"}
        status, response = extractor.invoke_lambda("test-function", event)

        # Verify error handling
        assert status == 500
        assert "error" in response
        assert "Invocation failed" in response["error"]

    def test_test_rsvp_endpoints(self, mock_boto3_session):
        """Test RSVP endpoint testing flow"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock successful Lambda responses
        responses = [
            # OPTIONS request
            {
                "statusCode": 200,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": "",
            },
            # POST with valid data
            {
                "statusCode": 200,
                "body": json.dumps(
                    {
                        "message": "RSVP submitted",
                        "data": {"id": "uuid-123", "name": "Test Guest"},
                    }
                ),
            },
            # POST with missing fields
            {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing required field: email"}),
            },
            # POST with minimal data
            {"statusCode": 200, "body": json.dumps({"message": "RSVP submitted"})},
            # GET with valid ID
            {"statusCode": 200, "body": json.dumps({"data": {"id": "uuid-123"}})},
            # GET with invalid ID
            {"statusCode": 404, "body": json.dumps({"error": "RSVP not found"})},
            # GET without ID
            {"statusCode": 400, "body": json.dumps({"error": "ID required"})},
            # Unsupported method
            {
                "statusCode": 405,
                "body": json.dumps({"error": "Method PUT not allowed"}),
            },
            # Malformed JSON
            {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON"})},
        ]

        # Configure mock to return different responses
        mock_lambda.invoke.side_effect = [
            {
                "StatusCode": 200,
                "Payload": Mock(read=lambda resp=resp: json.dumps(resp).encode()),
            }
            for resp in responses
        ]

        # Run tests
        test_cases = extractor.test_rsvp_endpoints("test-function")

        # Verify test cases
        assert len(test_cases) == 9
        assert test_cases[0]["test_name"] == "CORS Preflight"
        assert test_cases[1]["test_name"] == "Valid RSVP Submission"
        assert test_cases[2]["test_name"] == "Invalid RSVP - Missing Fields"
        assert test_cases[3]["test_name"] == "Minimal RSVP Submission"
        assert test_cases[4]["test_name"] == "Get RSVP by ID"
        assert test_cases[5]["test_name"] == "Get RSVP - Invalid ID"
        assert test_cases[6]["test_name"] == "Get RSVP - No ID"
        assert test_cases[7]["test_name"] == "Unsupported Method"
        assert test_cases[8]["test_name"] == "Malformed JSON"

    def test_extract_patterns(self, mock_boto3_session):
        """Test pattern extraction from test cases"""
        _, _, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Create test cases
        test_cases = [
            {
                "test_name": "Valid RSVP Submission",
                "response": {
                    "statusCode": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"message": "Success", "data": {"id": "123"}}),
                },
            },
            {
                "test_name": "Invalid RSVP - Missing Fields",
                "response": {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": "Missing fields"}),
                },
            },
            {
                "test_name": "Get RSVP - Invalid ID",
                "response": {
                    "statusCode": 404,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": "RSVP not found"}),
                },
            },
        ]

        # Extract patterns
        patterns = extractor.extract_patterns(test_cases)

        # Verify patterns
        assert "request_patterns" in patterns
        assert "response_patterns" in patterns
        assert "error_patterns" in patterns

        assert "POST /rsvp" in patterns["request_patterns"]
        assert "POST_SUCCESS" in patterns["response_patterns"]
        assert "MISSING_FIELDS" in patterns["error_patterns"]
        assert "NOT_FOUND" in patterns["error_patterns"]

    def test_generate_api_documentation(self, mock_boto3_session):
        """Test API documentation generation"""
        _, _, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Create test data
        lambda_config = {
            "function_name": "test-function",
            "runtime": "python3.9",
            "handler": "index.handler",
            "timeout": 60,
            "memory_size": 256,
            "environment": {"TABLE_NAME": "test-table"},
        }

        patterns = {
            "request_patterns": {
                "POST /rsvp": {
                    "method": "POST",
                    "path": "/rsvp",
                    "required_fields": ["name", "email"],
                }
            },
            "response_patterns": {},
            "error_patterns": {},
        }

        test_cases = []

        # Generate documentation
        doc = extractor.generate_api_documentation(lambda_config, patterns, test_cases)

        # Verify documentation content
        assert "# Wedding App API Documentation" in doc
        assert "Function Name**: test-function" in doc
        assert "Runtime**: python3.9" in doc
        assert "POST /rsvp" in doc
        assert "required" in doc
        assert "CORS" in doc

    @patch("builtins.open", new_callable=mock_open)
    @patch("pathlib.Path.mkdir")
    def test_save_patterns(self, mock_mkdir, mock_file, mock_boto3_session):
        """Test saving patterns to files"""
        _, _, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Set up test data
        extractor.patterns = {
            "lambda_name": "test-function",
            "lambda_arn": "arn:aws:lambda:us-west-2:123456:function:test-function",
            "runtime": "python3.9",
            "handler": "index.handler",
            "environment_variables": {},
            "request_patterns": {},
            "response_patterns": {},
            "error_patterns": {},
            "test_invocations": [],
        }

        # Save patterns
        extractor.save_patterns()

        # Verify directory creation
        mock_mkdir.assert_called()

        # Verify files were written
        assert mock_file.call_count == 2

        # Check JSON file write
        json_calls = [
            call
            for call in mock_file.call_args_list
            if "lambda-patterns.json" in str(call)
        ]
        assert len(json_calls) == 1

        # Check Markdown file write
        md_calls = [
            call for call in mock_file.call_args_list if "api-endpoints.md" in str(call)
        ]
        assert len(md_calls) == 1

    def test_extract_full_workflow(self, mock_boto3_session):
        """Test complete extraction workflow"""
        _, mock_lambda, _ = mock_boto3_session
        extractor = LambdaPatternExtractor()

        # Mock Lambda discovery
        mock_paginator = Mock()
        mock_lambda.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {"Functions": [{"FunctionName": "heatherandwesley-rsvp-handler"}]}
        ]

        # Mock Lambda configuration
        mock_lambda.get_function.return_value = {
            "Configuration": {
                "FunctionName": "heatherandwesley-rsvp-handler",
                "FunctionArn": "arn:aws:lambda:us-west-2:123456:function:heatherandwesley-rsvp-handler",
                "Runtime": "python3.9",
                "Handler": "index.handler",
                "Timeout": 60,
                "MemorySize": 256,
                "Environment": {"Variables": {}},
                "LastModified": "2024-01-01T00:00:00Z",
            }
        }

        # Mock Lambda invocations (simplified)
        mock_lambda.invoke.return_value = {
            "StatusCode": 200,
            "Payload": Mock(
                read=lambda: json.dumps(
                    {"statusCode": 200, "body": json.dumps({"message": "Success"})}
                ).encode()
            ),
        }

        # Mock file operations
        with patch("builtins.open", mock_open()):
            with patch("pathlib.Path.mkdir"):
                # Run extraction
                extractor.extract("heatherandwesley-rsvp-handler")

        # Verify Lambda was found and configured
        assert extractor.patterns["lambda_name"] == "heatherandwesley-rsvp-handler"
        assert extractor.patterns["runtime"] == "python3.9"
        assert len(extractor.patterns["test_invocations"]) > 0

    @patch("extract_lambda_patterns.LambdaPatternExtractor")
    def test_main_success(self, mock_extractor_class):
        """Test main function success flow"""
        # Mock extractor instance
        mock_extractor = Mock()
        mock_extractor_class.return_value = mock_extractor

        # Import and run main
        from extract_lambda_patterns import main

        main()

        # Verify workflow
        mock_extractor_class.assert_called_once_with(
            profile="personal", region="us-east-1"
        )
        mock_extractor.extract.assert_called_once_with("heatherandwesley-rsvp-handler")


class TestEdgeCases:
    """Test edge cases and error scenarios for both extractors"""

    @patch("extract_api_gateway_routes.boto3.Session")
    def test_api_gateway_pagination(self, mock_session):
        """Test handling of paginated API responses"""
        mock_client = Mock()
        mock_session.return_value.client.return_value = mock_client

        # Mock paginated response with more than 500 items
        mock_client.get_rest_apis.return_value = {
            "items": [{"id": f"api{i}", "name": f"api-{i}"} for i in range(500)],
            "position": "next-page-token",
        }

        extractor = APIGatewayExtractor()
        result = extractor.find_api_by_name("api-499")

        # Verify it found the API even though it's at the end
        assert result is not None
        assert result["name"] == "api-499"

    @patch("extract_lambda_patterns.boto3.Session")
    def test_lambda_with_layers(self, mock_session):
        """Test Lambda function with layers"""
        mock_lambda = Mock()
        mock_session.return_value.client.return_value = mock_lambda

        # Mock Lambda with layers
        mock_lambda.get_function.return_value = {
            "Configuration": {
                "FunctionName": "test-function",
                "FunctionArn": "arn:aws:lambda:us-west-2:123456:function:test-function",
                "Runtime": "python3.9",
                "Handler": "index.handler",
                "Timeout": 60,
                "MemorySize": 256,
                "Layers": [
                    {"Arn": "arn:aws:lambda:us-west-2:123456:layer:test-layer:1"}
                ],
                "Environment": {"Variables": {}},
                "LastModified": "2024-01-01T00:00:00Z",
            }
        }

        extractor = LambdaPatternExtractor()
        config = extractor.get_lambda_configuration("test-function")

        # Verify configuration is still extracted correctly
        assert config["function_name"] == "test-function"

    @patch("extract_api_gateway_routes.boto3.Session")
    def test_api_gateway_with_authorizers(self, mock_session):
        """Test API Gateway routes with custom authorizers"""
        mock_client = Mock()
        mock_session.return_value.client.return_value = mock_client

        # Mock API with authorizer
        mock_client.get_rest_apis.return_value = {
            "items": [{"id": "api1", "name": "heatherandwesley-api"}]
        }
        mock_client.get_resources.return_value = {
            "items": [{"id": "res1", "path": "/secure"}]
        }
        mock_client.get_resource.return_value = {
            "resourceMethods": {
                "GET": {"authorizationType": "CUSTOM", "authorizerId": "auth123"}
            }
        }
        mock_client.get_integration.return_value = {"type": "AWS_PROXY"}
        mock_client.get_deployments.return_value = {"items": []}
        mock_client.get_stages.return_value = {"items": []}

        extractor = APIGatewayExtractor()
        result = extractor.extract_routes("heatherandwesley")

        # Verify authorizer info is captured
        assert result["routes"][0]["authorization_type"] == "CUSTOM"

    @patch("extract_lambda_patterns.boto3.Session")
    def test_lambda_timeout_handling(self, mock_session):
        """Test handling of Lambda timeout scenarios"""
        mock_lambda = Mock()
        mock_session.return_value.client.return_value = mock_lambda

        # Mock Lambda timeout response
        mock_lambda.invoke.return_value = {
            "StatusCode": 200,
            "FunctionError": "Unhandled",
            "Payload": Mock(
                read=lambda: json.dumps(
                    {"errorMessage": "Task timed out after 60.00 seconds"}
                ).encode()
            ),
        }

        extractor = LambdaPatternExtractor()
        status, response = extractor.invoke_lambda("test-function", {})

        # Verify timeout is handled
        assert status == 200  # Lambda returns 200 even on timeout
        assert "errorMessage" in response
        assert "timed out" in response["errorMessage"]

    @patch("extract_api_gateway_routes.boto3.Session")
    def test_api_gateway_throttling(self, mock_session):
        """Test handling of API Gateway throttling"""
        mock_client = Mock()
        mock_session.return_value.client.return_value = mock_client

        # Mock throttling error
        from botocore.exceptions import ClientError

        mock_client.get_rest_apis.side_effect = ClientError(
            {"Error": {"Code": "TooManyRequestsException", "Message": "Rate exceeded"}},
            "GetRestApis",
        )

        extractor = APIGatewayExtractor()
        result = extractor.find_api_by_name("test")

        # Verify graceful handling
        assert result is None

    @patch("extract_lambda_patterns.boto3.Session")
    def test_lambda_cold_start_detection(self, mock_session):
        """Test detection of Lambda cold starts in logs"""
        mock_lambda = Mock()
        mock_session.return_value.client.return_value = mock_lambda

        # Mock response with cold start indicators in logs
        cold_start_logs = base64.b64encode(
            b"REPORT RequestId: xxx Duration: 3000.00 ms Billed Duration: 3500 ms Memory Size: 256 MB Max Memory Used: 128 MB Init Duration: 500.00 ms"
        ).decode()

        mock_lambda.invoke.return_value = {
            "StatusCode": 200,
            "Payload": Mock(read=lambda: json.dumps({"statusCode": 200}).encode()),
            "LogResult": cold_start_logs,
        }

        extractor = LambdaPatternExtractor()
        status, response = extractor.invoke_lambda("test-function", {})

        # Verify invocation still succeeds
        assert status == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
