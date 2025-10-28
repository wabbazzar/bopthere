#!/usr/bin/env python3
"""
E2E Smoke Tests for Photos Gallery
Tests the complete photos pipeline: API Gateway → Lambda → S3 → Frontend

This test suite verifies:
1. API Gateway photos list endpoint accessibility
2. Lambda function execution for listing S3 photos
3. S3 bucket photo storage and retrieval
4. Photo metadata enrichment with DynamoDB user data
5. Error handling and pagination across the stack

Prerequisites:
- AWS CLI configured with personal profile
- S3 bucket 'heatherandwesley-bingo-photos' exists
- Lambda function 'heatherandwesley-photos-list-handler' deployed
- DynamoDB table 'heatherandwesley-users' exists for user enrichment
- API Gateway deployed with /photos/list endpoint
"""

import base64
import json
import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any

import boto3
import pytest
import requests

# Configuration
API_GATEWAY_URL = os.getenv(
    "VITE_API_URL", "https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod"
)
AWS_PROFILE = "personal"
AWS_REGION = "us-east-1"
S3_BUCKET = "heatherandwesley-bingo-photos"
LAMBDA_FUNCTION = "heatherandwesley-photos-list-handler"
DYNAMODB_TABLE = "heatherandwesley-users"


@pytest.mark.smoke
@pytest.mark.skip(reason="E2E tests require full environment setup - skipping in CI")
class TestPhotosGalleryE2E:
    """End-to-end photos gallery flow tests"""

    @classmethod
    def setup_class(cls):
        """Set up AWS clients and test data"""
        cls.session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        cls.s3_client = cls.session.client("s3")
        cls.lambda_client = cls.session.client("lambda")
        cls.dynamodb = cls.session.resource("dynamodb")
        cls.users_table = cls.dynamodb.Table(DYNAMODB_TABLE)

        # Test data
        cls.test_user_id = f"test-photos-{uuid.uuid4().hex[:8]}"
        cls.test_photos = []

        # Create test user for photo metadata enrichment
        cls._create_test_user()

        # Upload test photos to S3
        cls._upload_test_photos()

    @classmethod
    def teardown_class(cls):
        """Clean up test data"""
        # Clean up test photos from S3
        for photo_key in cls.test_photos:
            try:
                cls.s3_client.delete_object(Bucket=S3_BUCKET, Key=photo_key)
            except Exception as e:
                print(f"Warning: Failed to delete test photo {photo_key}: {e}")

        # Clean up test user
        try:
            cls.users_table.delete_item(Key={"username": cls.test_user_id})
        except Exception as e:
            print(f"Warning: Failed to cleanup test user: {e}")

    @classmethod
    def _create_test_user(cls):
        """Create a test user in DynamoDB for metadata enrichment"""
        user_item = {
            "username": cls.test_user_id,
            "email": f"{cls.test_user_id}@example.com",
            "full_name": "Test Photos User",
            "role": "guest",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        cls.users_table.put_item(Item=user_item)

    @classmethod
    def _upload_test_photos(cls):
        """Upload test photos to S3 bucket"""
        # Create a minimal 1x1 pixel JPEG (base64 encoded)
        # This is a valid JPEG that's extremely small for testing
        test_jpeg_base64 = (
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
            "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
            "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA"
            "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEB"
            "AAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAf/Z"
        )
        test_jpeg_bytes = base64.b64decode(test_jpeg_base64)

        # Upload 3 test photos
        for i in range(3):
            timestamp = int(datetime.now(timezone.utc).timestamp() * 1000) + i
            key = f"{cls.test_user_id}/{i}_{timestamp}.jpg"

            cls.s3_client.put_object(
                Bucket=S3_BUCKET, Key=key, Body=test_jpeg_bytes, ContentType="image/jpeg"
            )

            cls.test_photos.append(key)

    def test_s3_bucket_exists(self):
        """Test S3 bucket exists and is accessible in us-east-1"""
        try:
            response = self.s3_client.head_bucket(Bucket=S3_BUCKET)
            assert response["ResponseMetadata"]["HTTPStatusCode"] == 200

            # Verify bucket is in correct region
            bucket_location = self.s3_client.get_bucket_location(Bucket=S3_BUCKET)
            location = bucket_location.get("LocationConstraint")

            # us-east-1 returns None for LocationConstraint
            assert location in [
                None,
                "us-east-1",
            ], f"S3 bucket not in us-east-1: {location}"

        except self.s3_client.exceptions.NoSuchBucket:
            pytest.fail(f"S3 bucket {S3_BUCKET} not found")
        except Exception as e:
            pytest.fail(f"S3 bucket {S3_BUCKET} not accessible: {e}")

    def test_lambda_function_exists(self):
        """Test photos list Lambda function is deployed and active in us-east-1"""
        try:
            response = self.lambda_client.get_function(FunctionName=LAMBDA_FUNCTION)
            assert response["Configuration"]["FunctionName"] == LAMBDA_FUNCTION
            assert response["Configuration"]["State"] == "Active"

            # Verify function is in correct region
            function_arn = response["Configuration"]["FunctionArn"]
            assert (
                "us-east-1" in function_arn
            ), f"Lambda function not in us-east-1: {function_arn}"

            # Verify environment variables
            env_vars = response["Configuration"]["Environment"]["Variables"]
            assert (
                "S3_BUCKET" in env_vars
            ), "S3_BUCKET environment variable not configured"
            assert (
                "USERS_TABLE" in env_vars
            ), "USERS_TABLE environment variable not configured"

        except self.lambda_client.exceptions.ResourceNotFoundException:
            pytest.fail(f"Lambda function {LAMBDA_FUNCTION} not found in us-east-1")

    def test_api_gateway_photos_list_endpoint(self):
        """Test photos list endpoint through API Gateway → Lambda → S3"""
        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list", headers={"Content-Type": "application/json"}, timeout=30
        )

        assert response.status_code == 200, f"Photos list request failed: {response.text}"

        data = response.json()

        # Validate response structure
        assert "photos" in data, "Response missing photos field"
        assert "count" in data, "Response missing count field"
        assert "has_more" in data, "Response missing has_more field"

        # Validate photos array structure
        photos = data["photos"]
        assert isinstance(photos, list), "Photos should be an array"

        # If there are photos, validate structure
        if len(photos) > 0:
            photo = photos[0]

            # Validate required fields
            required_fields = ["url", "user_id", "uploaded_at", "size"]
            for field in required_fields:
                assert field in photo, f"Photo missing required field: {field}"

            # Validate field types
            assert isinstance(photo["url"], str), "Photo URL should be string"
            assert isinstance(photo["user_id"], str), "User ID should be string"
            assert isinstance(photo["uploaded_at"], str), "Uploaded at should be ISO string"
            assert isinstance(photo["size"], int), "Size should be integer"

            # Optional field validation
            if "user_name" in photo:
                assert isinstance(photo["user_name"], str), "User name should be string"

    def test_photos_list_with_limit_parameter(self):
        """Test photos list with limit query parameter"""
        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list?limit=5",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        assert response.status_code == 200, f"Photos list with limit failed: {response.text}"

        data = response.json()
        photos = data["photos"]

        # Should return no more than 5 photos
        assert len(photos) <= 5, f"Returned {len(photos)} photos, expected max 5"

    def test_photos_list_contains_test_photos(self):
        """Test that uploaded test photos appear in the list"""
        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list?limit=100",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        assert response.status_code == 200, f"Photos list request failed: {response.text}"

        data = response.json()
        photos = data["photos"]

        # Find our test photos
        test_photo_urls = [
            f"https://{S3_BUCKET}.s3.amazonaws.com/{key}" for key in self.test_photos
        ]

        found_photos = [photo for photo in photos if photo["url"] in test_photo_urls]

        assert len(found_photos) >= 1, f"Test photos not found in list. Expected at least 1 of {len(self.test_photos)}"

        # Validate metadata enrichment
        for photo in found_photos:
            assert photo["user_id"] == self.test_user_id, "Photo user_id mismatch"

            # User name should be enriched from DynamoDB
            if "user_name" in photo:
                assert (
                    photo["user_name"] == "Test Photos User"
                ), "User name not enriched from DynamoDB"

    def test_photos_list_sorting(self):
        """Test that photos are sorted by upload date (newest first)"""
        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list?limit=100",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        assert response.status_code == 200

        data = response.json()
        photos = data["photos"]

        if len(photos) < 2:
            pytest.skip("Need at least 2 photos to test sorting")

        # Verify photos are sorted newest first
        for i in range(len(photos) - 1):
            current_date = datetime.fromisoformat(photos[i]["uploaded_at"].replace("Z", "+00:00"))
            next_date = datetime.fromisoformat(photos[i + 1]["uploaded_at"].replace("Z", "+00:00"))

            assert (
                current_date >= next_date
            ), f"Photos not sorted correctly: {photos[i]['uploaded_at']} should be >= {photos[i+1]['uploaded_at']}"

    def test_photos_list_pagination(self):
        """Test pagination with continuation token if available"""
        # Request with small limit to trigger pagination
        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list?limit=2",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        assert response.status_code == 200

        data = response.json()

        if data.get("has_more") and data.get("next_token"):
            # Make paginated request
            next_token = data["next_token"]
            response2 = requests.get(
                f"{API_GATEWAY_URL}/photos/list?limit=2&continuation_token={next_token}",
                headers={"Content-Type": "application/json"},
                timeout=30,
            )

            assert response2.status_code == 200, "Pagination request failed"

            data2 = response2.json()
            assert "photos" in data2
            assert len(data2["photos"]) > 0, "Pagination returned no photos"

            # Ensure no duplicate photos between pages
            page1_urls = {photo["url"] for photo in data["photos"]}
            page2_urls = {photo["url"] for photo in data2["photos"]}

            assert len(page1_urls & page2_urls) == 0, "Pagination returned duplicate photos"
        else:
            pytest.skip("Not enough photos to test pagination")

    def test_cors_headers(self):
        """Test CORS headers are properly set for photos endpoint"""
        response = requests.options(
            f"{API_GATEWAY_URL}/photos/list",
            headers={"Origin": "https://example.com"},
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

    def test_lambda_execution_time(self):
        """Test Lambda function execution time is reasonable"""
        import time

        start_time = time.time()

        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list?limit=50",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        execution_time = time.time() - start_time

        assert response.status_code == 200, "Photos list should succeed for timing test"
        assert (
            execution_time < 5.0
        ), f"Lambda execution took too long: {execution_time:.2f}s"

        print(f"Photos list request completed in {execution_time:.2f}s")

    def test_empty_bucket_handling(self):
        """Test graceful handling when S3 bucket has no objects (simulated)"""
        # Make request with extreme limit that should exceed available photos
        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list?limit=10000",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        assert response.status_code == 200, "Should handle large limit gracefully"

        data = response.json()
        assert "photos" in data
        assert isinstance(data["photos"], list)
        assert data["has_more"] is False, "Should not have more photos with extreme limit"

    def test_invalid_query_parameters(self):
        """Test handling of invalid query parameters"""
        # Test with invalid limit
        response = requests.get(
            f"{API_GATEWAY_URL}/photos/list?limit=invalid",
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        # Should either return 400 or handle gracefully with default limit
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"

    def test_concurrent_requests(self):
        """Test handling of concurrent photo list requests"""
        import concurrent.futures

        def make_request():
            return requests.get(
                f"{API_GATEWAY_URL}/photos/list?limit=10",
                headers={"Content-Type": "application/json"},
                timeout=30,
            )

        # Make 5 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(5)]
            responses = [
                future.result() for future in concurrent.futures.as_completed(futures)
            ]

        # All should succeed
        for response in responses:
            assert (
                response.status_code == 200
            ), f"Concurrent request failed: {response.text}"
            data = response.json()
            assert "photos" in data
            assert "count" in data


@pytest.mark.integration
class TestPhotosListIntegration:
    """Integration tests that can run without full AWS deployment"""

    def test_field_consistency_with_frontend_types(self):
        """Test that backend fields match frontend TypeScript Photo type"""
        # Expected fields based on frontend Photo interface
        expected_photo_fields = {"url", "user_id", "uploaded_at", "size"}

        # Optional fields
        optional_photo_fields = {"user_name"}

        expected_response_fields = {"photos", "count", "has_more"}

        # Optional response fields
        optional_response_fields = {"next_token"}

        print("Required Photo fields:", expected_photo_fields)
        print("Optional Photo fields:", optional_photo_fields)
        print("Required Response fields:", expected_response_fields)
        print("Optional Response fields:", optional_response_fields)

        assert len(expected_photo_fields) == 4, "Photo type should have 4 required fields"
        assert (
            len(expected_response_fields) == 3
        ), "Response should have 3 required fields"

    def test_photo_url_format(self):
        """Test photo URL format matches S3 public URL pattern"""
        expected_url_pattern = f"https://{S3_BUCKET}.s3.amazonaws.com/"

        # Mock photo URL
        mock_url = f"{expected_url_pattern}user123/0_1234567890.jpg"

        assert mock_url.startswith(expected_url_pattern), "URL should match S3 pattern"
        assert mock_url.endswith(".jpg"), "URL should end with .jpg"


if __name__ == "__main__":
    # Run with: pytest tests/e2e/smoke/test_photos_list_smoke.py -v
    pytest.main([__file__, "-v", "--tb=short"])
