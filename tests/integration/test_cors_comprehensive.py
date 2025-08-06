#!/usr/bin/env python3
"""
Comprehensive CORS Test Suite
Tests ALL API Gateway endpoints for proper CORS configuration
"""

import json
from typing import Dict, List, Optional, Tuple

import pytest
import requests


class CORSTestConfig:
    """Configuration for CORS testing"""

    # API Gateway endpoints to test
    API_BASE_URL = "https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod"

    # Test origins (including dev servers)
    TEST_ORIGINS = [
        "http://localhost:8080",  # Current dev server
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Vite alternative
        "https://heatherandwesley.com",  # Production
    ]

    # Expected CORS headers
    REQUIRED_CORS_HEADERS = [
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Methods",
        "Access-Control-Allow-Headers",
    ]

    # Endpoints to test
    ENDPOINTS = [
        # Auth endpoints
        {"path": "/auth/login", "methods": ["POST", "OPTIONS"]},
        {"path": "/auth/register", "methods": ["POST", "OPTIONS"]},
        {"path": "/auth/verify", "methods": ["POST", "OPTIONS"]},
        # RSVP endpoints
        {"path": "/rsvp", "methods": ["GET", "POST", "OPTIONS"]},
        {"path": "/rsvp/test-id", "methods": ["GET", "PUT", "DELETE", "OPTIONS"]},
        # Leaderboard endpoints
        {"path": "/leaderboard/tetris", "methods": ["GET", "POST", "OPTIONS"]},
        {"path": "/leaderboard/snake", "methods": ["GET", "POST", "OPTIONS"]},
        # Health endpoint
        {"path": "/health", "methods": ["GET", "OPTIONS"]},
    ]


def test_cors_preflight_request(endpoint_path: str, origin: str) -> Tuple[bool, Dict]:
    """
    Test CORS preflight (OPTIONS) request for an endpoint

    Returns:
        Tuple of (success, response_data)
    """
    url = f"{CORSTestConfig.API_BASE_URL}{endpoint_path}"

    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
    }

    try:
        response = requests.options(url, headers=headers, timeout=10)

        response_data = {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "url": url,
            "origin": origin,
        }

        return response.status_code == 200, response_data

    except Exception as e:
        return False, {
            "error": str(e),
            "url": url,
            "origin": origin,
        }


def test_cors_actual_request(
    endpoint_path: str, method: str, origin: str
) -> Tuple[bool, Dict]:
    """
    Test actual CORS request (not preflight)

    Returns:
        Tuple of (success, response_data)
    """
    url = f"{CORSTestConfig.API_BASE_URL}{endpoint_path}"

    headers = {
        "Origin": origin,
        "Content-Type": "application/json",
    }

    # Prepare request data for different methods
    data = None
    if method in ["POST", "PUT"]:
        data = json.dumps({"test": "data"})

    try:
        response = requests.request(method, url, headers=headers, data=data, timeout=10)

        response_data = {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "url": url,
            "origin": origin,
            "method": method,
        }

        # Check for CORS headers in actual response
        has_cors = "Access-Control-Allow-Origin" in response.headers

        return has_cors, response_data

    except Exception as e:
        return False, {
            "error": str(e),
            "url": url,
            "origin": origin,
            "method": method,
        }


def validate_cors_headers(headers: Dict[str, str], expected_origin: str) -> List[str]:
    """
    Validate CORS headers and return list of issues
    """
    issues = []

    # Check required headers
    for required_header in CORSTestConfig.REQUIRED_CORS_HEADERS:
        if required_header not in headers:
            issues.append(f"Missing required header: {required_header}")

    # Check Access-Control-Allow-Origin
    if "Access-Control-Allow-Origin" in headers:
        allowed_origin = headers["Access-Control-Allow-Origin"]
        if allowed_origin not in [expected_origin, "*"]:
            issues.append(
                f"Origin mismatch: expected {expected_origin}, got {allowed_origin}"
            )

    # Check methods
    if "Access-Control-Allow-Methods" in headers:
        methods = headers["Access-Control-Allow-Methods"]
        if "OPTIONS" not in methods:
            issues.append("OPTIONS method not in Access-Control-Allow-Methods")

    return issues


def run_comprehensive_cors_test():
    """
    Run comprehensive CORS test across all endpoints and origins
    """
    print("🧪 Running Comprehensive CORS Test Suite")
    print("=" * 60)

    total_tests = 0
    failed_tests = 0
    results = []

    for endpoint in CORSTestConfig.ENDPOINTS:
        path = endpoint["path"]
        methods = endpoint["methods"]

        print(f"\n📍 Testing endpoint: {path}")

        for origin in CORSTestConfig.TEST_ORIGINS:
            print(f"  🌐 Origin: {origin}")

            # Test preflight (OPTIONS)
            if "OPTIONS" in methods:
                total_tests += 1
                success, result = test_cors_preflight_request(path, origin)

                if not success:
                    failed_tests += 1
                    print(f"    ❌ Preflight FAILED: {result}")
                    results.append(
                        {
                            "endpoint": path,
                            "origin": origin,
                            "type": "preflight",
                            "success": False,
                            "details": result,
                        }
                    )
                else:
                    # Validate CORS headers
                    issues = validate_cors_headers(result["headers"], origin)
                    if issues:
                        failed_tests += 1
                        print(f"    ⚠️  Preflight issues: {', '.join(issues)}")
                        results.append(
                            {
                                "endpoint": path,
                                "origin": origin,
                                "type": "preflight",
                                "success": False,
                                "details": {"issues": issues, **result},
                            }
                        )
                    else:
                        print(f"    ✅ Preflight OK")
                        results.append(
                            {
                                "endpoint": path,
                                "origin": origin,
                                "type": "preflight",
                                "success": True,
                                "details": result,
                            }
                        )

            # Test actual requests
            for method in [m for m in methods if m != "OPTIONS"]:
                total_tests += 1
                success, result = test_cors_actual_request(path, method, origin)

                if not success:
                    failed_tests += 1
                    print(f"    ❌ {method} FAILED: {result}")
                    results.append(
                        {
                            "endpoint": path,
                            "origin": origin,
                            "type": f"actual_{method}",
                            "success": False,
                            "details": result,
                        }
                    )
                else:
                    issues = validate_cors_headers(result["headers"], origin)
                    if issues:
                        failed_tests += 1
                        print(f"    ⚠️  {method} issues: {', '.join(issues)}")
                        results.append(
                            {
                                "endpoint": path,
                                "origin": origin,
                                "type": f"actual_{method}",
                                "success": False,
                                "details": {"issues": issues, **result},
                            }
                        )
                    else:
                        print(f"    ✅ {method} OK")
                        results.append(
                            {
                                "endpoint": path,
                                "origin": origin,
                                "type": f"actual_{method}",
                                "success": True,
                                "details": result,
                            }
                        )

    # Summary
    print("\n" + "=" * 60)
    print(f"📊 CORS Test Summary:")
    print(f"   Total tests: {total_tests}")
    print(f"   Passed: {total_tests - failed_tests}")
    print(f"   Failed: {failed_tests}")

    if failed_tests > 0:
        print(f"\n❌ {failed_tests} CORS issues found!")

        # Group failures by type
        failures_by_endpoint = {}
        for result in results:
            if not result["success"]:
                endpoint = result["endpoint"]
                if endpoint not in failures_by_endpoint:
                    failures_by_endpoint[endpoint] = []
                failures_by_endpoint[endpoint].append(result)

        print("\n🔍 Failure Details:")
        for endpoint, failures in failures_by_endpoint.items():
            print(f"\n  📍 {endpoint}:")
            for failure in failures:
                print(f"    - {failure['origin']} ({failure['type']})")
                if "issues" in failure["details"]:
                    for issue in failure["details"]["issues"]:
                        print(f"      • {issue}")
                if "error" in failure["details"]:
                    print(f"      • Error: {failure['details']['error']}")
                if "status_code" in failure["details"]:
                    print(f"      • Status: {failure['details']['status_code']}")
    else:
        print("\n✅ All CORS tests passed!")

    return failed_tests == 0, results


if __name__ == "__main__":
    success, results = run_comprehensive_cors_test()

    # Save results to file
    with open("cors_test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n📄 Detailed results saved to: cors_test_results.json")

    if not success:
        exit(1)
