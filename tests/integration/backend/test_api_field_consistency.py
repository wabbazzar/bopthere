#!/usr/bin/env python3
"""
Test suite for validating field consistency across DynamoDB schema, Lambda handlers, and API documentation.

This module ensures that:
1. DynamoDB schema fields match Lambda handler expectations
2. API endpoint documentation matches actual Lambda patterns
3. Field types are consistent across all layers
4. Required fields are properly documented
5. All documented fields are actually used
6. No undocumented fields exist in Lambda responses
"""

import ast
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

import pytest


class TestAPIFieldConsistency:
    """Test suite for API field consistency validation"""

    @pytest.fixture
    def project_root(self):
        """Get the project root directory"""
        return Path(__file__).parent.parent.parent.parent

    @pytest.fixture
    def dynamodb_schema(self, project_root):
        """Load DynamoDB schema from context file"""
        schema_path = project_root / ".wedding" / "context" / "dynamodb-schemas.json"
        with open(schema_path, "r") as f:
            data = json.load(f)
        return data["schemas"]["heatherandwesley-users"]

    @pytest.fixture
    def api_documentation(self, project_root):
        """Parse API documentation"""
        api_doc_path = project_root / ".wedding" / "context" / "api-endpoints.md"
        with open(api_doc_path, "r") as f:
            content = f.read()

        # Extract request/response fields from documentation
        request_fields = self._extract_request_fields(content)
        response_fields = self._extract_response_fields(content)
        required_fields = self._extract_required_fields(content)

        return {
            "request_fields": request_fields,
            "response_fields": response_fields,
            "required_fields": required_fields,
            "content": content,
        }

    @pytest.fixture
    def lambda_handler_analysis(self, project_root):
        """Analyze Lambda handler code"""
        handler_path = project_root / "aws" / "lambda" / "rsvp-handler.py"
        with open(handler_path, "r") as f:
            code = f.read()

        # Parse the Python code
        tree = ast.parse(code)

        # Extract field usage
        field_usage = self._analyze_lambda_fields(tree, code)

        return {"code": code, "tree": tree, "field_usage": field_usage}

    def _extract_request_fields(self, content: str) -> Dict[str, Set[str]]:
        """Extract request fields from API documentation"""
        fields = {}

        # Find request JSON blocks
        request_pattern = r"#### Request\s*\n+```json\s*\n(.*?)\n```"
        matches = re.findall(request_pattern, content, re.DOTALL)

        for match in matches:
            # Parse field definitions
            field_pattern = r'"(\w+)":\s*"([^"]+)"'
            for field_match in re.findall(field_pattern, match):
                field_name = field_match[0]
                field_type = field_match[1]

                # Determine if it's required or optional
                is_required = "required" in field_type
                is_optional = "optional" in field_type

                # Extract type - handle special cases like "yes|no"
                if "|" in field_type:
                    # This is an enum type (like yes|no)
                    field_type_clean = field_type.split()[0]  # Get the enum part
                else:
                    type_match = re.match(r"(\w+)", field_type)
                    field_type_clean = type_match.group(1) if type_match else "string"

                if field_name not in fields:
                    fields[field_name] = {
                        "type": field_type_clean,
                        "required": is_required,
                        "optional": is_optional,
                    }

        return fields

    def _extract_response_fields(self, content: str) -> Set[str]:
        """Extract response fields from API documentation"""
        fields = set()

        # Find response JSON blocks
        response_pattern = (
            r"#### (?:Success|Error) Response.*?\n+```json\s*\n(.*?)\n```"
        )
        matches = re.findall(response_pattern, content, re.DOTALL)

        for match in matches:
            # Extract field names from response
            field_pattern = r'"(\w+)":'
            for field_match in re.findall(field_pattern, match):
                fields.add(field_match)

        return fields

    def _extract_required_fields(self, content: str) -> Set[str]:
        """Extract required fields from API documentation"""
        required = set()

        # Look for explicit required field mentions
        required_pattern = r'"(\w+)":\s*"[^"]*\(required\)'
        for match in re.findall(required_pattern, content):
            required.add(match)

        # Also check for required fields list in request validation
        validation_pattern = r"required_fields\s*=\s*\[(.*?)\]"
        validation_match = re.search(validation_pattern, content, re.DOTALL)
        if validation_match:
            fields_str = validation_match.group(1)
            field_names = re.findall(r"'(\w+)'", fields_str)
            required.update(field_names)

        return required

    def _analyze_lambda_fields(self, tree: ast.AST, code: str) -> Dict[str, Any]:
        """Analyze Lambda handler for field usage"""
        analysis = {
            "request_fields": set(),
            "response_fields": set(),
            "dynamodb_fields": set(),
            "required_validation": set(),
            "field_defaults": {},
            "field_transformations": {},
        }

        # Find required fields validation
        required_pattern = r"required_fields\s*=\s*\[(.*?)\]"
        match = re.search(required_pattern, code)
        if match:
            fields_str = match.group(1)
            # Handle both single and double quotes
            field_names = re.findall(r"['\"](\w+)['\"]", fields_str)
            analysis["required_validation"].update(field_names)

        # Find body field access (request fields) - handle both quote types
        body_pattern = r"body\[['\"](\w+)['\"]\]|body\.get\(['\"](\w+)['\"][^)]*\)"
        for match in re.findall(body_pattern, code):
            field = match[0] or match[1]
            analysis["request_fields"].add(field)

            # Check for default values - handle both quote types
            default_pattern = rf"body\.get\(['\"]({field})['\"],\s*([^)]+)\)"
            default_match = re.search(default_pattern, code)
            if default_match:
                analysis["field_defaults"][field] = default_match.group(2).strip()

        # Find item dictionary construction (DynamoDB fields)
        # Look for field assignments in item dictionary
        item_pattern = r'"(\w+)":\s*(?:body\[|body\.get\(|current_time|rsvp_id|str\(uuid\.uuid4\(\)\))'
        for match in re.findall(item_pattern, code):
            analysis["dynamodb_fields"].add(match)
        
        # Also look for literal field names in item construction
        item_block_pattern = r'item\s*=\s*\{([^}]+)\}'
        item_match = re.search(item_block_pattern, code, re.DOTALL)
        if item_match:
            item_content = item_match.group(1)
            # Extract field names from the item dictionary
            field_pattern = r'"(\w+)":'
            for field_match in re.findall(field_pattern, item_content):
                analysis["dynamodb_fields"].add(field_match)

        # Find response fields
        response_pattern = (
            r"'data':\s*(?:decimal_to_float\()?(?:item|response\['Item'\])"
        )
        if re.search(response_pattern, code):
            # Response includes all DynamoDB fields
            analysis["response_fields"] = analysis["dynamodb_fields"].copy()

        # Additional response fields
        response_field_pattern = r"'(\w+)':\s*['\"].*?['\"]"
        for match in re.findall(response_field_pattern, code):
            if match in ["message", "error", "data"]:
                analysis["response_fields"].add(match)

        return analysis

    def test_dynamodb_schema_matches_lambda_usage(
        self, dynamodb_schema, lambda_handler_analysis
    ):
        """Test that Lambda handler only uses fields defined in DynamoDB schema"""
        schema_fields = set(dynamodb_schema["properties"].keys())
        lambda_fields = lambda_handler_analysis["field_usage"]["dynamodb_fields"]

        # Fields used in Lambda but not in schema
        undefined_fields = lambda_fields - schema_fields
        assert not undefined_fields, (
            f"Lambda handler uses fields not defined in DynamoDB schema: {undefined_fields}\n"
            f"DynamoDB schema fields: {sorted(schema_fields)}\n"
            f"Lambda DynamoDB fields: {sorted(lambda_fields)}"
        )

        # Fields in schema but not used in Lambda (warning, not error)
        unused_fields = schema_fields - lambda_fields
        if unused_fields:
            print(
                f"Warning: DynamoDB schema defines fields not used in Lambda: {unused_fields}"
            )

    def test_api_documentation_matches_lambda_patterns(
        self, api_documentation, lambda_handler_analysis
    ):
        """Test that API documentation matches actual Lambda implementation"""
        doc_request_fields = set(api_documentation["request_fields"].keys())
        lambda_request_fields = lambda_handler_analysis["field_usage"]["request_fields"]

        # Check request fields match
        doc_only = doc_request_fields - lambda_request_fields
        lambda_only = lambda_request_fields - doc_request_fields

        assert (
            not doc_only
        ), f"API documentation lists request fields not used by Lambda: {doc_only}"
        assert (
            not lambda_only
        ), f"Lambda accepts request fields not documented in API: {lambda_only}"

        # Check response fields match
        doc_response_fields = api_documentation["response_fields"]
        lambda_response_fields = lambda_handler_analysis["field_usage"][
            "response_fields"
        ]

        # Core response fields that should be documented
        core_response_fields = {"message", "error", "data"}
        missing_core = core_response_fields - doc_response_fields
        assert (
            not missing_core
        ), f"API documentation missing core response fields: {missing_core}"

    def test_field_types_consistent(self, dynamodb_schema, api_documentation):
        """Test that field types are consistent across all layers"""
        schema_types = {}
        for field, props in dynamodb_schema["properties"].items():
            schema_types[field] = props["type"]

        # Map API doc types to JSON schema types
        type_mapping = {
            "string": "string",
            "boolean": "boolean",
            "yes|no": "string",  # attendance field
            "uuid": "string",
            "ISO": "string",  # timestamps
        }

        # Check documented request field types
        for field, field_info in api_documentation["request_fields"].items():
            if field in schema_types:
                doc_type = field_info["type"]
                expected_type = schema_types[field]

                # Map the documented type
                mapped_type = type_mapping.get(doc_type, doc_type)

                assert mapped_type == expected_type, (
                    f"Field '{field}' type mismatch:\n"
                    f"  API documentation: {doc_type} (mapped to {mapped_type})\n"
                    f"  DynamoDB schema: {expected_type}"
                )

    def test_required_fields_properly_documented(
        self, dynamodb_schema, api_documentation, lambda_handler_analysis
    ):
        """Test that required fields are properly documented and validated"""
        # DynamoDB required fields
        schema_required = set(dynamodb_schema.get("required", []))

        # API documented required fields
        doc_required = api_documentation["required_fields"]

        # Lambda validated required fields
        lambda_required = lambda_handler_analysis["field_usage"]["required_validation"]

        # Check that Lambda validates all documented required fields
        missing_validation = doc_required - lambda_required
        assert (
            not missing_validation
        ), f"Required fields documented but not validated in Lambda: {missing_validation}"

        # Check that all Lambda-validated fields are documented as required
        undocumented_required = lambda_required - doc_required
        assert (
            not undocumented_required
        ), f"Lambda validates fields not documented as required: {undocumented_required}"

        # Note: DynamoDB schema marks all fields as required, but API only requires name, email, attendance
        # This is intentional - DynamoDB items have all fields, but API accepts partial data with defaults
        print(
            f"Info: DynamoDB requires all fields, API requires subset: {lambda_required}"
        )

    def test_all_documented_fields_are_used(
        self, api_documentation, lambda_handler_analysis
    ):
        """Test that all documented fields are actually used in the implementation"""
        doc_fields = set(api_documentation["request_fields"].keys())
        lambda_fields = lambda_handler_analysis["field_usage"]["request_fields"]

        # Find documented but unused fields
        unused_fields = doc_fields - lambda_fields
        assert (
            not unused_fields
        ), f"API documentation includes fields that are never used: {unused_fields}"

    def test_no_undocumented_response_fields(
        self, api_documentation, lambda_handler_analysis, dynamodb_schema
    ):
        """Test that Lambda doesn't return fields not documented in API"""
        # Get all possible response fields from Lambda
        lambda_response_fields = lambda_handler_analysis["field_usage"][
            "response_fields"
        ]

        # Get documented response fields (including nested in 'data')
        doc_response_fields = api_documentation["response_fields"]

        # For fields inside 'data', they should match DynamoDB schema
        schema_fields = set(dynamodb_schema["properties"].keys())

        # Lambda response fields should either be top-level (message, error, data) or schema fields
        top_level_fields = {"message", "error", "data"}

        # Check that all Lambda response fields are either documented or are schema fields
        for field in lambda_response_fields:
            if field not in top_level_fields and field not in schema_fields:
                assert (
                    field in doc_response_fields
                ), f"Lambda returns undocumented field: {field}"

    def test_field_defaults_match_schema(
        self, lambda_handler_analysis, dynamodb_schema
    ):
        """Test that field defaults in Lambda match schema expectations"""
        defaults = lambda_handler_analysis["field_usage"]["field_defaults"]

        # Expected defaults based on schema
        expected_defaults = {
            "phone": '""',  # empty string
            "notifications": "False",  # boolean false
            "dietary_restrictions": '""',
            "song_request": '""',
            "message_for_couple": '""',
        }

        for field, default in expected_defaults.items():
            if field in defaults:
                assert defaults[field] == default, (
                    f"Field '{field}' has unexpected default:\n"
                    f"  Expected: {default}\n"
                    f"  Actual: {defaults[field]}"
                )

    def test_timestamp_fields_consistency(
        self, dynamodb_schema, lambda_handler_analysis
    ):
        """Test that timestamp fields are handled consistently"""
        timestamp_fields = {"created_at", "updated_at"}
        schema_fields = set(dynamodb_schema["properties"].keys())

        # Ensure timestamp fields are in schema
        missing_timestamps = timestamp_fields - schema_fields
        assert (
            not missing_timestamps
        ), f"Timestamp fields missing from schema: {missing_timestamps}"

        # Check that timestamps are strings in schema
        for field in timestamp_fields:
            if field in dynamodb_schema["properties"]:
                assert (
                    dynamodb_schema["properties"][field]["type"] == "string"
                ), f"Timestamp field '{field}' should be type 'string'"

        # Verify Lambda generates timestamps
        lambda_fields = lambda_handler_analysis["field_usage"]["dynamodb_fields"]
        assert timestamp_fields.issubset(
            lambda_fields
        ), f"Lambda doesn't set all timestamp fields"

    def test_attendance_field_values(self, dynamodb_schema, api_documentation):
        """Test that attendance field values are documented correctly"""
        # Check schema examples
        attendance_examples = dynamodb_schema["properties"]["attendance"].get(
            "examples", []
        )
        assert (
            "yes" in attendance_examples or "no" in attendance_examples
        ), "Attendance field should have 'yes'/'no' examples"

        # Check API documentation
        doc_content = api_documentation["content"]
        assert (
            "yes|no" in doc_content
        ), "API documentation should specify attendance as 'yes|no'"

    def generate_consistency_report(
        self, dynamodb_schema, api_documentation, lambda_handler_analysis
    ):
        """Generate a comprehensive consistency report"""
        report = []
        report.append("=== API Field Consistency Report ===\n")
        report.append(f"Generated: {datetime.utcnow().isoformat()}Z\n")

        # DynamoDB Schema Summary
        schema_fields = set(dynamodb_schema["properties"].keys())
        report.append(f"\nDynamoDB Schema Fields ({len(schema_fields)}):")
        for field in sorted(schema_fields):
            field_type = dynamodb_schema["properties"][field]["type"]
            required = field in dynamodb_schema.get("required", [])
            report.append(
                f"  - {field}: {field_type} {'(required)' if required else ''}"
            )

        # Lambda Handler Summary
        lambda_fields = lambda_handler_analysis["field_usage"]
        report.append(
            f"\nLambda Request Fields ({len(lambda_fields['request_fields'])}):"
        )
        for field in sorted(lambda_fields["request_fields"]):
            required = field in lambda_fields["required_validation"]
            default = lambda_fields["field_defaults"].get(field, "N/A")
            report.append(
                f"  - {field} {'(required)' if required else f'(default: {default})'}"
            )

        # API Documentation Summary
        doc_fields = api_documentation["request_fields"]
        report.append(f"\nAPI Documented Fields ({len(doc_fields)}):")
        for field, info in sorted(doc_fields.items()):
            report.append(
                f"  - {field}: {info['type']} {'(required)' if info['required'] else '(optional)'}"
            )

        # Consistency Issues
        report.append("\nConsistency Analysis:")

        # Check for mismatches
        all_fields = (
            schema_fields | set(doc_fields.keys()) | lambda_fields["request_fields"]
        )

        # Fields that are auto-generated by Lambda (not from request)
        auto_generated_fields = {"id", "created_at", "updated_at"}

        warnings_found = False
        for field in sorted(all_fields):
            issues = []
            if field not in schema_fields:
                issues.append("Missing from DynamoDB schema")
            if field not in doc_fields and field not in auto_generated_fields:
                issues.append("Missing from API documentation")
            if field not in lambda_fields["request_fields"] and field in doc_fields:
                issues.append("Documented but not used in Lambda")

            if issues:
                report.append(f"  ⚠️  {field}: {', '.join(issues)}")
                warnings_found = True

        # Add notes about auto-generated fields
        if auto_generated_fields & schema_fields:
            report.append("\n  ℹ️  Auto-generated fields (not part of request):")
            for field in sorted(auto_generated_fields & schema_fields):
                report.append(f"     - {field}: Generated by Lambda handler")

        if not warnings_found:
            report.append("  ✅ All fields are consistent across all layers")

        return "\n".join(report)

    def test_nested_response_fields(self, api_documentation, dynamodb_schema):
        """Test that nested fields in 'data' response match DynamoDB schema"""
        # The API returns all DynamoDB fields nested under 'data'
        doc_content = api_documentation["content"]

        # Extract fields from success response 'data' object
        data_pattern = r'"data":\s*\{([^}]+)\}'
        match = re.search(data_pattern, doc_content, re.DOTALL)

        if match:
            data_fields_text = match.group(1)
            field_pattern = r'"(\w+)":'
            data_fields = set(re.findall(field_pattern, data_fields_text))

            # All data fields should be in DynamoDB schema
            schema_fields = set(dynamodb_schema["properties"].keys())
            undefined_fields = data_fields - schema_fields

            assert (
                not undefined_fields
            ), f"Response 'data' contains fields not in DynamoDB schema: {undefined_fields}"

    def test_error_response_consistency(self, api_documentation):
        """Test that error responses have consistent structure"""
        doc_content = api_documentation["content"]

        # Find all error response patterns
        error_patterns = re.findall(
            r"#### Error Response.*?\n```json\s*\n(.*?)\n```", doc_content, re.DOTALL
        )

        # All error responses should have 'error' field
        for error_json in error_patterns:
            assert (
                '"error":' in error_json
            ), f"Error response missing 'error' field: {error_json}"

    def test_lambda_validation_matches_documentation(
        self, lambda_handler_analysis, api_documentation
    ):
        """Test that Lambda's field validation matches documented requirements"""
        # Lambda validates these fields as required
        lambda_required = lambda_handler_analysis["field_usage"]["required_validation"]

        # API documentation says these are required
        doc_required = api_documentation["required_fields"]

        # They should match exactly
        assert lambda_required == doc_required, (
            f"Mismatch in required field validation:\n"
            f"  Lambda validates: {sorted(lambda_required)}\n"
            f"  Documentation requires: {sorted(doc_required)}"
        )

    def test_field_naming_conventions(self, dynamodb_schema):
        """Test that all fields follow consistent naming conventions"""
        # All fields should be snake_case
        for field_name in dynamodb_schema["properties"].keys():
            assert (
                field_name.islower() or "_" in field_name
            ), f"Field '{field_name}' doesn't follow snake_case convention"

            # No spaces or special characters
            assert re.match(
                r"^[a-z_]+$", field_name
            ), f"Field '{field_name}' contains invalid characters"

    def test_optional_fields_have_defaults(
        self, api_documentation, lambda_handler_analysis
    ):
        """Test that all optional fields have default values in Lambda"""
        # Get optional fields from documentation
        optional_fields = {
            field
            for field, info in api_documentation["request_fields"].items()
            if info.get("optional", False)
        }

        # Get fields with defaults from Lambda
        fields_with_defaults = set(
            lambda_handler_analysis["field_usage"]["field_defaults"].keys()
        )

        # All optional fields should have defaults
        missing_defaults = optional_fields - fields_with_defaults
        assert (
            not missing_defaults
        ), f"Optional fields missing default values in Lambda: {missing_defaults}"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])
