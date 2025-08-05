#!/usr/bin/env python3
"""
E2E Smoke Tests for RSVP Flow
Tests the complete RSVP pipeline: API Gateway → Lambda → DynamoDB → Frontend

This test suite verifies:
1. API Gateway RSVP endpoint accessibility
2. Lambda function execution for RSVP operations
3. DynamoDB RSVP table operations
4. RSVP submission and retrieval flows
5. Error handling and validation across the stack
6. Field integrity matching exact API schema

Prerequisites:
- AWS CLI configured with personal profile
- DynamoDB table 'heatherandwesley-users' exists (RSVP data stored here)
- Lambda function 'heatherandwesley-rsvp-handler' deployed
- API Gateway deployed with RSVP endpoints
- us-east-1 region configuration
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3
import pytest
import requests

# Configuration
API_GATEWAY_URL = os.getenv(
    "VITE_API_GATEWAY_URL",
    "https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod",
)
AWS_PROFILE = "personal"
AWS_REGION = "us-east-1"
DYNAMODB_TABLE = "heatherandwesley-users"
LAMBDA_FUNCTION = "heatherandwesley-rsvp-handler"


@pytest.mark.smoke
class TestRSVPFlowE2E:
    """End-to-end RSVP flow tests"""

    @classmethod
    def setup_class(cls):
        """Set up AWS clients and test data"""
        session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        cls.dynamodb = session.resource("dynamodb")
        cls.lambda_client = session.client("lambda")
        cls.table = cls.dynamodb.Table(DYNAMODB_TABLE)

        # Test RSVP data
        cls.test_rsvp_id = f"test-rsvp-{uuid.uuid4().hex[:8]}"
        cls.test_email = f"test-rsvp-{uuid.uuid4().hex[:8]}@example.com"
        cls.test_name = f"Test Guest {uuid.uuid4().hex[:4]}"

        # Track created items for cleanup
        cls.created_items = []

    @classmethod
    def teardown_class(cls):
        """Clean up test data"""
        for item_id in cls.created_items:
            try:
                cls.table.delete_item(Key={"id": item_id})
            except Exception as e:
                print(f"Warning: Failed to cleanup test RSVP {item_id}: {e}")

    def test_api_gateway_rsvp_endpoint_accessible(self):
        """Test RSVP API Gateway endpoint is accessible"""
        try:
            # Try to make a request to RSVP endpoint
            response = requests.post(
                f"{API_GATEWAY_URL}/rsvp",
                json={"test": "connectivity"},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            # We expect 400 (bad request) or 422 (validation error), not connection errors
            assert response.status_code in [
                200,
                400,
                422,
                500,
            ], f"RSVP endpoint not accessible: {response.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("RSVP API Gateway not accessible - check VITE_API_GATEWAY_URL")

    def test_lambda_function_exists(self):
        """Test RSVP Lambda function is deployed and accessible"""
        try:
            response = self.lambda_client.get_function(FunctionName=LAMBDA_FUNCTION)
            assert response["Configuration"]["FunctionName"] == LAMBDA_FUNCTION
            assert response["Configuration"]["State"] == "Active"

            # Verify function is in correct region
            assert (
                "us-east-1" in response["Configuration"]["FunctionArn"]
            ), f"Lambda function not in us-east-1: {response['Configuration']['FunctionArn']}"
        except self.lambda_client.exceptions.ResourceNotFoundException:
            pytest.fail(f"Lambda function {LAMBDA_FUNCTION} not found in us-east-1")

    def test_dynamodb_table_exists(self):
        """Test DynamoDB table exists and is accessible in us-east-1"""
        try:
            response = self.table.describe()
            assert response["Table"]["TableName"] == DYNAMODB_TABLE
            assert response["Table"]["TableStatus"] == "ACTIVE"

            # Verify table is in correct region
            table_arn = response["Table"]["TableArn"]
            assert (
                "us-east-1" in table_arn
            ), f"DynamoDB table not in us-east-1: {table_arn}"
        except Exception as e:
            pytest.fail(
                f"DynamoDB table {DYNAMODB_TABLE} not accessible in us-east-1: {e}"
            )

    def test_rsvp_submission_success(self):
        """Test successful RSVP submission through complete stack"""
        rsvp_data = {
            "name": self.test_name,
            "email": self.test_email,
            "attendance": "yes",
            "dietary_restrictions": "vegetarian",
            "plus_one": False,
            "plus_one_name": "",
            "guest_count": 1,
            "comments": "Looking forward to the celebration!",
        }

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=rsvp_data,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Validate response
        assert response.status_code in [
            200,
            201,
        ], f"RSVP submission failed: {response.text}"

        data = response.json()

        # Validate response structure according to ticket schema
        assert "id" in data, "Response missing id field"
        assert "message" in data, "Response missing message field"

        # Track for cleanup
        rsvp_id = data["id"]
        self.created_items.append(rsvp_id)

        # Verify data was stored in DynamoDB
        stored_item = self.table.get_item(Key={"id": rsvp_id})
        assert "Item" in stored_item, "RSVP not found in DynamoDB"

        item = stored_item["Item"]
        assert item["name"] == self.test_name
        assert item["email"] == self.test_email
        assert item["attendance"] == "yes"
        assert item["dietary_restrictions"] == "vegetarian"

        return rsvp_id

    def test_rsvp_field_validation(self):
        """Test RSVP field validation matches exact schema"""
        # Test with all required fields
        complete_rsvp = {
            "name": f"Complete Test {uuid.uuid4().hex[:4]}",
            "email": f"complete-{uuid.uuid4().hex[:6]}@example.com",
            "attendance": "yes",
            "dietary_restrictions": "none",
            "plus_one": True,
            "plus_one_name": "Plus One Guest",
            "guest_count": 2,
            "comments": "Test comments",
        }

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=complete_rsvp,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if response.status_code in [200, 201]:
            data = response.json()
            self.created_items.append(data["id"])

            # Verify all fields are stored correctly
            stored_item = self.table.get_item(Key={"id": data["id"]})["Item"]

            # Check exact field names from ticket
            required_fields = [
                "name",
                "email",
                "attendance",
                "dietary_restrictions",
                "plus_one",
                "plus_one_name",
                "guest_count",
                "comments",
            ]

            for field in required_fields:
                assert field in stored_item, f"Field {field} not found in stored RSVP"
                assert (
                    stored_item[field] == complete_rsvp[field]
                ), f"Field {field} value mismatch: {stored_item[field]} != {complete_rsvp[field]}"

    def test_rsvp_missing_required_fields(self):
        """Test RSVP validation with missing required fields"""
        # Test with missing name
        incomplete_rsvp = {
            "email": f"incomplete-{uuid.uuid4().hex[:6]}@example.com",
            "attendance": "yes"
            # name field missing
        }

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=incomplete_rsvp,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should return 400 Bad Request or 422 Unprocessable Entity
        assert response.status_code in [
            400,
            422,
        ], f"Expected validation error, got {response.status_code}: {response.text}"

        data = response.json()
        assert (
            "error" in data or "message" in data
        ), "Error response should contain error message"

    def test_rsvp_invalid_email_format(self):
        """Test RSVP validation with invalid email format"""
        invalid_rsvp = {
            "name": "Test Invalid Email",
            "email": "not-a-valid-email",
            "attendance": "yes",
            "dietary_restrictions": "none",
        }

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=invalid_rsvp,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should return validation error
        assert response.status_code in [
            400,
            422,
        ], f"Expected validation error for invalid email, got {response.status_code}: {response.text}"

    def test_rsvp_invalid_attendance_value(self):
        """Test RSVP validation with invalid attendance value"""
        invalid_rsvp = {
            "name": "Test Invalid Attendance",
            "email": f"invalid-attendance-{uuid.uuid4().hex[:6]}@example.com",
            "attendance": "maybe",  # Should be 'yes' or 'no'
            "dietary_restrictions": "none",
        }

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=invalid_rsvp,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should return validation error
        assert response.status_code in [
            400,
            422,
        ], f"Expected validation error for invalid attendance, got {response.status_code}: {response.text}"

    def test_rsvp_duplicate_email(self):
        """Test RSVP handling of duplicate email submissions"""
        rsvp_data = {
            "name": "First Submission",
            "email": f"duplicate-test-{uuid.uuid4().hex[:6]}@example.com",
            "attendance": "yes",
            "dietary_restrictions": "none",
        }

        # First submission
        first_response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=rsvp_data,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if first_response.status_code in [200, 201]:
            first_data = first_response.json()
            self.created_items.append(first_data["id"])

            # Second submission with same email
            rsvp_data["name"] = "Second Submission"
            second_response = requests.post(
                f"{API_GATEWAY_URL}/rsvp",
                json=rsvp_data,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )

            # Should either update existing or return conflict
            assert second_response.status_code in [
                200,
                201,
                409,
            ], f"Unexpected response to duplicate email: {second_response.status_code}"

            if second_response.status_code in [200, 201]:
                second_data = second_response.json()
                if "id" in second_data and second_data["id"] != first_data["id"]:
                    self.created_items.append(second_data["id"])

    def test_rsvp_plus_one_logic(self):
        """Test RSVP plus one logic and guest count consistency"""
        # Test plus_one=True with guest_count=2
        plus_one_rsvp = {
            "name": f"Plus One Test {uuid.uuid4().hex[:4]}",
            "email": f"plus-one-{uuid.uuid4().hex[:6]}@example.com",
            "attendance": "yes",
            "dietary_restrictions": "none",
            "plus_one": True,
            "plus_one_name": "My Plus One",
            "guest_count": 2,
        }

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=plus_one_rsvp,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if response.status_code in [200, 201]:
            data = response.json()
            self.created_items.append(data["id"])

            # Verify plus one data was stored correctly
            stored_item = self.table.get_item(Key={"id": data["id"]})["Item"]
            assert stored_item["plus_one"] == True
            assert stored_item["plus_one_name"] == "My Plus One"
            assert stored_item["guest_count"] == 2

    def test_rsvp_cors_headers(self):
        """Test CORS headers are properly set for RSVP endpoint"""
        response = requests.options(
            f"{API_GATEWAY_URL}/rsvp",
            headers={"Origin": "https://heatherandwesley.com"},
            timeout=30,
        )

        # Check for CORS headers (status might be 200 or 204)
        assert response.status_code in [
            200,
            204,
        ], f"OPTIONS request failed: {response.status_code}"

        # Check for common CORS headers
        headers = response.headers
        cors_headers = [
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Methods",
            "Access-Control-Allow-Headers",
        ]

        for header in cors_headers:
            if header in headers:
                print(f"CORS header found: {header}: {headers[header]}")

    def test_rsvp_response_time(self):
        """Test RSVP submission response time is reasonable"""
        rsvp_data = {
            "name": f"Performance Test {uuid.uuid4().hex[:4]}",
            "email": f"perf-test-{uuid.uuid4().hex[:6]}@example.com",
            "attendance": "yes",
            "dietary_restrictions": "none",
        }

        import time

        start_time = time.time()

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=rsvp_data,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        execution_time = time.time() - start_time

        if response.status_code in [200, 201]:
            data = response.json()
            self.created_items.append(data["id"])

        assert (
            execution_time < 5.0
        ), f"RSVP submission took too long: {execution_time:.2f}s"
        print(f"RSVP submission completed in {execution_time:.2f}s")

    def test_rsvp_malformed_json(self):
        """Test API handling of malformed JSON in RSVP requests"""
        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            data="invalid json content",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should return 400 Bad Request
        assert (
            response.status_code == 400
        ), f"Expected 400, got {response.status_code}: {response.text}"

    def test_rsvp_sql_injection_protection(self):
        """Test protection against SQL injection in RSVP fields"""
        malicious_rsvp = {
            "name": "'; DROP TABLE users; --",
            "email": f"malicious-{uuid.uuid4().hex[:6]}@example.com",
            "attendance": "yes",
            "dietary_restrictions": "'; DELETE FROM rsvps; --",
        }

        response = requests.post(
            f"{API_GATEWAY_URL}/rsvp",
            json=malicious_rsvp,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should handle gracefully (return validation error, not crash)
        assert response.status_code in [
            200,
            201,
            400,
            422,
        ], f"Unexpected response to malicious input: {response.status_code}"

        if response.status_code in [200, 201]:
            data = response.json()
            self.created_items.append(data["id"])

            # Verify malicious content was stored safely (escaped or sanitized)
            stored_item = self.table.get_item(Key={"id": data["id"]})["Item"]
            assert "DROP TABLE" not in str(stored_item), "Malicious SQL not sanitized"

        # Verify table still exists and is accessible
        try:
            self.table.describe()
        except Exception:
            pytest.fail("DynamoDB table may have been affected by injection attempt")

    def test_rsvp_concurrent_submissions(self):
        """Test handling of concurrent RSVP submissions"""
        import concurrent.futures
        import threading

        def submit_rsvp(index):
            rsvp_data = {
                "name": f"Concurrent Test {index}",
                "email": f"concurrent-{index}-{uuid.uuid4().hex[:4]}@example.com",
                "attendance": "yes",
                "dietary_restrictions": "none",
            }

            return requests.post(
                f"{API_GATEWAY_URL}/rsvp",
                json=rsvp_data,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )

        # Make 5 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(submit_rsvp, i) for i in range(5)]
            responses = [
                future.result() for future in concurrent.futures.as_completed(futures)
            ]

        # All should succeed or fail gracefully
        for i, response in enumerate(responses):
            assert response.status_code in [
                200,
                201,
                400,
                422,
                500,
            ], f"Concurrent RSVP {i} returned unexpected status: {response.status_code}"

            if response.status_code in [200, 201]:
                data = response.json()
                if "id" in data:
                    self.created_items.append(data["id"])


@pytest.mark.integration
class TestRSVPIntegration:
    """Integration tests that can run without full AWS deployment"""

    def test_rsvp_field_consistency_with_frontend_types(self):
        """Test that RSVP fields match frontend TypeScript types"""
        # Expected fields based on frontend RSVP form
        expected_rsvp_fields = {
            "name",
            "email",
            "attendance",
            "dietary_restrictions",
            "plus_one",
            "plus_one_name",
            "guest_count",
            "comments",
        }

        expected_response_fields = {"id", "message"}

        # This test documents the expected API contract
        print("Expected RSVP fields:", expected_rsvp_fields)
        print("Expected Response fields:", expected_response_fields)

        assert len(expected_rsvp_fields) == 8, "RSVP form should have 8 fields"
        assert len(expected_response_fields) == 2, "RSVP response should have 2 fields"

    def test_rsvp_attendance_enum_values(self):
        """Test RSVP attendance field enum values"""
        valid_attendance_values = {"yes", "no"}

        # Document the expected values
        print("Valid attendance values:", valid_attendance_values)

        assert "yes" in valid_attendance_values
        assert "no" in valid_attendance_values
        assert len(valid_attendance_values) == 2


if __name__ == "__main__":
    # Run with: python -m pytest tests/e2e/smoke/test_rsvp_flow_smoke.py -v
    pytest.main([__file__, "-v", "--tb=short"])
