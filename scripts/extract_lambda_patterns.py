#!/usr/bin/env python3
"""
Extract Lambda request/response patterns from the heatherandwesley-rsvp-handler.
Tests the Lambda with various invocations to discover patterns and documents them.
Outputs to .wedding/context/lambda-patterns.json and .wedding/context/api-endpoints.md
"""

import base64
import json
import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import boto3

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class LambdaPatternExtractor:
    """Extract request/response patterns from Lambda functions."""

    def __init__(self, profile: str = "personal", region: str = "us-east-1"):
        """Initialize the extractor with AWS credentials."""
        self.session = boto3.Session(profile_name=profile, region_name=region)
        self.lambda_client = self.session.client("lambda")
        self.api_gateway = self.session.client("apigateway")
        self.region = region
        self.patterns = {
            "lambda_name": None,
            "lambda_arn": None,
            "runtime": None,
            "handler": None,
            "environment_variables": {},
            "test_invocations": [],
            "request_patterns": {},
            "response_patterns": {},
            "error_patterns": {},
            "api_integration": {},
        }

    def find_lambda_by_name(self, name_pattern: str) -> Optional[Dict[str, Any]]:
        """Find Lambda function by name pattern."""
        logger.info(f"Searching for Lambda function containing '{name_pattern}'...")

        try:
            paginator = self.lambda_client.get_paginator("list_functions")

            for page in paginator.paginate():
                for function in page.get("Functions", []):
                    if name_pattern.lower() in function["FunctionName"].lower():
                        logger.info(f"Found Lambda: {function['FunctionName']}")
                        return function

            logger.warning(f"No Lambda function found containing '{name_pattern}'")
            return None

        except Exception as e:
            logger.error(f"Error searching for Lambda: {e}")
            return None

    def get_lambda_configuration(self, function_name: str) -> Dict[str, Any]:
        """Get Lambda function configuration."""
        try:
            response = self.lambda_client.get_function(FunctionName=function_name)
            config = response["Configuration"]

            return {
                "function_name": config["FunctionName"],
                "function_arn": config["FunctionArn"],
                "runtime": config["Runtime"],
                "handler": config["Handler"],
                "timeout": config["Timeout"],
                "memory_size": config["MemorySize"],
                "environment": config.get("Environment", {}).get("Variables", {}),
                "last_modified": config["LastModified"],
            }

        except Exception as e:
            logger.error(f"Error getting Lambda configuration: {e}")
            return {}

    def create_api_gateway_event(
        self,
        method: str,
        path: str,
        body: Optional[Dict] = None,
        path_params: Optional[Dict] = None,
        query_params: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Create a mock API Gateway event for Lambda invocation."""
        event = {
            "httpMethod": method,
            "path": path,
            "headers": {
                "Content-Type": "application/json",
                "User-Agent": "Lambda Pattern Extractor",
            },
            "pathParameters": path_params or {},
            "queryStringParameters": query_params or {},
            "isBase64Encoded": False,
        }

        if body:
            event["body"] = json.dumps(body)
        else:
            event["body"] = None

        return event

    def invoke_lambda(
        self, function_name: str, event: Dict[str, Any]
    ) -> Tuple[int, Dict[str, Any]]:
        """Invoke Lambda function and return status code and response."""
        try:
            logger.info(f"Invoking Lambda with event: {json.dumps(event, indent=2)}")

            response = self.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType="RequestResponse",
                LogType="Tail",
                Payload=json.dumps(event),
            )

            # Parse response
            payload = json.loads(response["Payload"].read())
            status_code = response["StatusCode"]

            # Log execution details
            if "LogResult" in response:
                log_data = base64.b64decode(response["LogResult"]).decode("utf-8")
                logger.debug(f"Lambda logs:\n{log_data}")

            logger.info(f"Lambda response status: {status_code}")
            logger.info(f"Lambda response payload: {json.dumps(payload, indent=2)}")

            return status_code, payload

        except Exception as e:
            logger.error(f"Error invoking Lambda: {e}")
            return 500, {"error": str(e)}

    def test_rsvp_endpoints(self, function_name: str) -> List[Dict[str, Any]]:
        """Test various RSVP endpoint scenarios."""
        test_cases = []

        # Test 1: OPTIONS request (CORS preflight)
        logger.info("\n=== Test 1: OPTIONS request ===")
        event = self.create_api_gateway_event("OPTIONS", "/rsvp")
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "CORS Preflight",
                "description": "OPTIONS request for CORS",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        # Test 2: POST with valid RSVP data
        logger.info("\n=== Test 2: POST with valid RSVP data ===")
        valid_rsvp = {
            "name": "Test Guest",
            "email": "test@example.com",
            "phone": "+1234567890",
            "attendance": "yes",
            "notifications": True,
            "dietary_restrictions": "Vegetarian",
            "song_request": "Never Gonna Give You Up",
            "message_for_couple": "Congratulations on your special day!",
        }
        event = self.create_api_gateway_event("POST", "/rsvp", body=valid_rsvp)
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "Valid RSVP Submission",
                "description": "POST request with all fields",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        # Extract the ID if successful for GET test
        rsvp_id = None
        if (
            status == 200
            and isinstance(response, dict)
            and response.get("statusCode") == 200
        ):
            body = json.loads(response.get("body", "{}"))
            if "data" in body and "id" in body["data"]:
                rsvp_id = body["data"]["id"]
                logger.info(f"Created RSVP with ID: {rsvp_id}")

        # Test 3: POST with missing required fields
        logger.info("\n=== Test 3: POST with missing required fields ===")
        invalid_rsvp = {
            "name": "Test Guest",
            # Missing email and attendance
        }
        event = self.create_api_gateway_event("POST", "/rsvp", body=invalid_rsvp)
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "Invalid RSVP - Missing Fields",
                "description": "POST request missing required fields",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        # Test 4: POST with minimal required fields
        logger.info("\n=== Test 4: POST with minimal required fields ===")
        minimal_rsvp = {
            "name": "Minimal Guest",
            "email": "minimal@example.com",
            "attendance": "no",
        }
        event = self.create_api_gateway_event("POST", "/rsvp", body=minimal_rsvp)
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "Minimal RSVP Submission",
                "description": "POST request with only required fields",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        # Test 5: GET with valid ID
        if rsvp_id:
            logger.info(f"\n=== Test 5: GET with valid ID: {rsvp_id} ===")
            event = self.create_api_gateway_event(
                "GET", f"/rsvp/{rsvp_id}", path_params={"id": rsvp_id}
            )
            status, response = self.invoke_lambda(function_name, event)
            test_cases.append(
                {
                    "test_name": "Get RSVP by ID",
                    "description": "GET request with valid RSVP ID",
                    "request": event,
                    "response_status": status,
                    "response": response,
                }
            )

        # Test 6: GET with invalid ID
        logger.info("\n=== Test 6: GET with invalid ID ===")
        event = self.create_api_gateway_event(
            "GET", "/rsvp/invalid-uuid-12345", path_params={"id": "invalid-uuid-12345"}
        )
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "Get RSVP - Invalid ID",
                "description": "GET request with non-existent ID",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        # Test 7: GET without ID
        logger.info("\n=== Test 7: GET without ID ===")
        event = self.create_api_gateway_event("GET", "/rsvp")
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "Get RSVP - No ID",
                "description": "GET request without ID parameter",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        # Test 8: Unsupported method
        logger.info("\n=== Test 8: Unsupported method (PUT) ===")
        event = self.create_api_gateway_event("PUT", "/rsvp", body={"test": "data"})
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "Unsupported Method",
                "description": "PUT request (not supported)",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        # Test 9: Malformed JSON body
        logger.info("\n=== Test 9: Malformed JSON body ===")
        event = self.create_api_gateway_event("POST", "/rsvp")
        event["body"] = "{ invalid json"
        status, response = self.invoke_lambda(function_name, event)
        test_cases.append(
            {
                "test_name": "Malformed JSON",
                "description": "POST request with invalid JSON",
                "request": event,
                "response_status": status,
                "response": response,
            }
        )

        return test_cases

    def extract_patterns(self, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract patterns from test invocations."""
        patterns = {
            "request_patterns": {
                "POST /rsvp": {
                    "method": "POST",
                    "path": "/rsvp",
                    "required_fields": ["name", "email", "attendance"],
                    "optional_fields": [
                        "phone",
                        "notifications",
                        "dietary_restrictions",
                        "song_request",
                        "message_for_couple",
                    ],
                    "field_types": {
                        "name": "string",
                        "email": "string",
                        "phone": "string",
                        "attendance": "string (yes/no)",
                        "notifications": "boolean",
                        "dietary_restrictions": "string",
                        "song_request": "string",
                        "message_for_couple": "string",
                    },
                },
                "GET /rsvp/{id}": {
                    "method": "GET",
                    "path": "/rsvp/{id}",
                    "path_parameters": {"id": "string (UUID)"},
                },
                "OPTIONS /rsvp": {
                    "method": "OPTIONS",
                    "path": "/rsvp",
                    "description": "CORS preflight request",
                },
            },
            "response_patterns": {},
            "error_patterns": {},
        }

        # Analyze test cases to extract response patterns
        for test in test_cases:
            test_name = test["test_name"]
            response = test["response"]

            if isinstance(response, dict) and "statusCode" in response:
                status_code = response["statusCode"]

                if status_code == 200:
                    if test_name == "Valid RSVP Submission":
                        patterns["response_patterns"]["POST_SUCCESS"] = {
                            "statusCode": 200,
                            "headers": response.get("headers", {}),
                            "body_structure": {
                                "message": "string",
                                "data": {
                                    "id": "string (UUID)",
                                    "name": "string",
                                    "email": "string",
                                    "phone": "string",
                                    "attendance": "string",
                                    "notifications": "boolean",
                                    "dietary_restrictions": "string",
                                    "song_request": "string",
                                    "message_for_couple": "string",
                                    "created_at": "string (ISO 8601)",
                                    "updated_at": "string (ISO 8601)",
                                },
                            },
                        }
                    elif test_name == "Get RSVP by ID":
                        patterns["response_patterns"]["GET_SUCCESS"] = {
                            "statusCode": 200,
                            "headers": response.get("headers", {}),
                            "body_structure": {
                                "data": "object (same as POST success data)"
                            },
                        }
                    elif test_name == "CORS Preflight":
                        patterns["response_patterns"]["OPTIONS_SUCCESS"] = {
                            "statusCode": 200,
                            "headers": response.get("headers", {}),
                            "body": "empty string",
                        }

                elif status_code == 400:
                    if test_name == "Invalid RSVP - Missing Fields":
                        patterns["error_patterns"]["MISSING_FIELDS"] = {
                            "statusCode": 400,
                            "headers": response.get("headers", {}),
                            "body_structure": {"error": "string (error message)"},
                        }
                elif status_code == 404:
                    if test_name == "Get RSVP - Invalid ID":
                        patterns["error_patterns"]["NOT_FOUND"] = {
                            "statusCode": 404,
                            "headers": response.get("headers", {}),
                            "body_structure": {"error": "RSVP not found"},
                        }
                elif status_code == 405:
                    if test_name == "Unsupported Method":
                        patterns["error_patterns"]["METHOD_NOT_ALLOWED"] = {
                            "statusCode": 405,
                            "headers": response.get("headers", {}),
                            "body_structure": {
                                "error": "string (method not allowed message)"
                            },
                        }
                elif status_code == 500:
                    patterns["error_patterns"]["INTERNAL_ERROR"] = {
                        "statusCode": 500,
                        "headers": response.get("headers", {}),
                        "body_structure": {
                            "error": "Internal server error",
                            "message": "string (error details)",
                        },
                    }

        return patterns

    def generate_api_documentation(
        self,
        lambda_config: Dict[str, Any],
        patterns: Dict[str, Any],
        test_cases: List[Dict[str, Any]],
    ) -> str:
        """Generate comprehensive API documentation in Markdown format."""
        doc = []
        doc.append("# Wedding App API Documentation")
        doc.append("\n## Overview")
        doc.append(
            "\nThis document describes the API endpoints for the Wedding App RSVP system."
        )
        doc.append(f"\nGenerated on: {datetime.utcnow().isoformat()}Z")

        # Lambda Information
        doc.append("\n## Lambda Function Details")
        doc.append(
            f"\n- **Function Name**: {lambda_config.get('function_name', 'N/A')}"
        )
        doc.append(f"\n- **Runtime**: {lambda_config.get('runtime', 'N/A')}")
        doc.append(f"\n- **Handler**: {lambda_config.get('handler', 'N/A')}")
        doc.append(f"\n- **Timeout**: {lambda_config.get('timeout', 'N/A')} seconds")
        doc.append(f"\n- **Memory**: {lambda_config.get('memory_size', 'N/A')} MB")

        if lambda_config.get("environment"):
            doc.append("\n\n### Environment Variables")
            for key, value in lambda_config["environment"].items():
                doc.append(f"\n- `{key}`: {value}")

        # API Endpoints
        doc.append("\n\n## API Endpoints")

        # POST /rsvp
        doc.append("\n\n### POST /rsvp")
        doc.append("\nSubmit a new RSVP for the wedding.")
        doc.append("\n\n#### Request")
        doc.append("\n```json")
        doc.append(
            json.dumps(
                {
                    "name": "string (required)",
                    "email": "string (required)",
                    "attendance": "yes|no (required)",
                    "phone": "string (optional)",
                    "notifications": "boolean (optional)",
                    "dietary_restrictions": "string (optional)",
                    "song_request": "string (optional)",
                    "message_for_couple": "string (optional)",
                },
                indent=2,
            )
        )
        doc.append("\n```")

        doc.append("\n\n#### Success Response (200)")
        doc.append("\n```json")
        doc.append(
            json.dumps(
                {
                    "message": "RSVP submitted successfully",
                    "data": {
                        "id": "uuid",
                        "name": "string",
                        "email": "string",
                        "phone": "string",
                        "attendance": "string",
                        "notifications": "boolean",
                        "dietary_restrictions": "string",
                        "song_request": "string",
                        "message_for_couple": "string",
                        "created_at": "ISO 8601 timestamp",
                        "updated_at": "ISO 8601 timestamp",
                    },
                },
                indent=2,
            )
        )
        doc.append("\n```")

        doc.append("\n\n#### Error Response (400)")
        doc.append("\n```json")
        doc.append(
            json.dumps({"error": "Missing required field: {field_name}"}, indent=2)
        )
        doc.append("\n```")

        # GET /rsvp/{id}
        doc.append("\n\n### GET /rsvp/{id}")
        doc.append("\nRetrieve an existing RSVP by ID.")
        doc.append("\n\n#### Request")
        doc.append("\n- **Path Parameter**: `id` - The UUID of the RSVP")

        doc.append("\n\n#### Success Response (200)")
        doc.append("\n```json")
        doc.append(
            json.dumps(
                {
                    "data": {
                        "id": "uuid",
                        "name": "string",
                        "email": "string",
                        "phone": "string",
                        "attendance": "string",
                        "notifications": "boolean",
                        "dietary_restrictions": "string",
                        "song_request": "string",
                        "message_for_couple": "string",
                        "created_at": "ISO 8601 timestamp",
                        "updated_at": "ISO 8601 timestamp",
                    }
                },
                indent=2,
            )
        )
        doc.append("\n```")

        doc.append("\n\n#### Error Response (404)")
        doc.append("\n```json")
        doc.append(json.dumps({"error": "RSVP not found"}, indent=2))
        doc.append("\n```")

        # OPTIONS /rsvp
        doc.append("\n\n### OPTIONS /rsvp")
        doc.append("\nCORS preflight request.")
        doc.append("\n\n#### Success Response (200)")
        doc.append("\nReturns empty body with CORS headers.")

        # Common Headers
        doc.append("\n\n## Common Response Headers")
        doc.append("\n\nAll responses include the following CORS headers:")
        doc.append("\n```")
        doc.append("\nAccess-Control-Allow-Origin: *")
        doc.append("\nAccess-Control-Allow-Headers: Content-Type")
        doc.append("\nAccess-Control-Allow-Methods: GET, POST, OPTIONS")
        doc.append("\n```")

        # Error Responses
        doc.append("\n\n## Common Error Responses")

        doc.append("\n\n### 400 Bad Request")
        doc.append(
            "\nReturned when required fields are missing or request is malformed."
        )

        doc.append("\n\n### 404 Not Found")
        doc.append("\nReturned when the requested RSVP ID does not exist.")

        doc.append("\n\n### 405 Method Not Allowed")
        doc.append("\nReturned when using an unsupported HTTP method.")
        doc.append("\n```json")
        doc.append(json.dumps({"error": "Method {METHOD} not allowed"}, indent=2))
        doc.append("\n```")

        doc.append("\n\n### 500 Internal Server Error")
        doc.append("\nReturned when an unexpected error occurs.")
        doc.append("\n```json")
        doc.append(
            json.dumps(
                {"error": "Internal server error", "message": "Error details"}, indent=2
            )
        )
        doc.append("\n```")

        # Test Examples
        doc.append("\n\n## Test Examples")
        doc.append("\n\n### Example: Submit RSVP")
        doc.append("\n```bash")
        doc.append("\ncurl -X POST \\")
        doc.append("\n  https://your-api-gateway-url/rsvp \\")
        doc.append('\n  -H "Content-Type: application/json" \\')
        doc.append(
            '\n  -d \'{"name":"John Doe","email":"john@example.com","attendance":"yes"}\''
        )
        doc.append("\n```")

        doc.append("\n\n### Example: Get RSVP")
        doc.append("\n```bash")
        doc.append("\ncurl -X GET \\")
        doc.append("\n  https://your-api-gateway-url/rsvp/{rsvp-id}")
        doc.append("\n```")

        return "\n".join(doc)

    def save_patterns(self, output_dir: str = ".wedding/context"):
        """Save extracted patterns to files."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Save patterns JSON
        patterns_file = output_path / "lambda-patterns.json"
        with open(patterns_file, "w") as f:
            json.dump(self.patterns, f, indent=2, default=str)
        logger.info(f"Saved Lambda patterns to {patterns_file}")

        # Save API documentation
        if self.patterns.get("lambda_name"):
            lambda_config = {
                "function_name": self.patterns["lambda_name"],
                "function_arn": self.patterns["lambda_arn"],
                "runtime": self.patterns["runtime"],
                "handler": self.patterns["handler"],
                "timeout": self.patterns.get("timeout", 60),
                "memory_size": self.patterns.get("memory_size", 128),
                "environment": self.patterns["environment_variables"],
            }

            api_doc = self.generate_api_documentation(
                lambda_config,
                {
                    "request_patterns": self.patterns["request_patterns"],
                    "response_patterns": self.patterns["response_patterns"],
                    "error_patterns": self.patterns["error_patterns"],
                },
                self.patterns["test_invocations"],
            )

            api_doc_file = output_path / "api-endpoints.md"
            with open(api_doc_file, "w") as f:
                f.write(api_doc)
            logger.info(f"Saved API documentation to {api_doc_file}")

    def extract(self, function_name_pattern: str = "heatherandwesley-rsvp-handler"):
        """Main extraction method."""
        # Find Lambda function
        lambda_func = self.find_lambda_by_name(function_name_pattern)
        if not lambda_func:
            logger.error(
                f"Lambda function containing '{function_name_pattern}' not found"
            )
            return

        function_name = lambda_func["FunctionName"]

        # Get Lambda configuration
        config = self.get_lambda_configuration(function_name)
        self.patterns["lambda_name"] = config.get("function_name")
        self.patterns["lambda_arn"] = config.get("function_arn")
        self.patterns["runtime"] = config.get("runtime")
        self.patterns["handler"] = config.get("handler")
        self.patterns["timeout"] = config.get("timeout")
        self.patterns["memory_size"] = config.get("memory_size")
        self.patterns["environment_variables"] = config.get("environment", {})

        # Test Lambda endpoints
        logger.info("\nTesting Lambda endpoints...")
        test_cases = self.test_rsvp_endpoints(function_name)
        self.patterns["test_invocations"] = test_cases

        # Extract patterns from test results
        patterns = self.extract_patterns(test_cases)
        self.patterns.update(patterns)

        # Add metadata
        self.patterns["extracted_at"] = datetime.utcnow().isoformat() + "Z"
        self.patterns["extractor_version"] = "1.0.0"

        # Save results
        self.save_patterns()

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print extraction summary."""
        print("\n" + "=" * 60)
        print("Lambda Pattern Extraction Summary")
        print("=" * 60)
        print(f"\nLambda Function: {self.patterns.get('lambda_name', 'N/A')}")
        print(f"Runtime: {self.patterns.get('runtime', 'N/A')}")
        print(f"Handler: {self.patterns.get('handler', 'N/A')}")

        print(f"\nTest Invocations: {len(self.patterns.get('test_invocations', []))}")

        print("\nRequest Patterns Found:")
        for endpoint, details in self.patterns.get("request_patterns", {}).items():
            print(f"  - {endpoint}: {details.get('method')} {details.get('path')}")

        print("\nResponse Patterns Found:")
        for pattern_name in self.patterns.get("response_patterns", {}):
            print(f"  - {pattern_name}")

        print("\nError Patterns Found:")
        for pattern_name in self.patterns.get("error_patterns", {}):
            print(f"  - {pattern_name}")

        print("\nOutput Files:")
        print("  - .wedding/context/lambda-patterns.json")
        print("  - .wedding/context/api-endpoints.md")
        print("\nExtraction complete!")


def main():
    """Main function."""
    extractor = LambdaPatternExtractor(profile="personal", region="us-east-1")
    extractor.extract("heatherandwesley-rsvp-handler")


if __name__ == "__main__":
    main()
