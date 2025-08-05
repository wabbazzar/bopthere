#!/usr/bin/env python3
"""
Seed test user for leaderboard testing.
Creates a specific test user in auth-users table with known credentials.
"""

import hashlib
import uuid
from datetime import datetime, timezone

import boto3


def seed_test_user():
    """Create a test user for leaderboard testing."""
    # Configuration
    table_name = "heatherandwesley-auth-users"
    test_user = {
        "id": f"test-leaderboard-{uuid.uuid4().hex[:8]}",
        "username": "leaderboard_test_user",
        "email": "leaderboard.test@example.com",
        "password": "TestPassword123!",  # Known password for testing
        "full_name": "Leaderboard Test User",
        "role": "guest",
    }

    # Create session
    session = boto3.Session(profile_name="personal", region_name="us-east-1")
    dynamodb = session.resource("dynamodb")
    table = dynamodb.Table(table_name)

    # Hash password (matching auth-handler logic)
    password_hash = hashlib.sha256(test_user["password"].encode()).hexdigest()

    # Create user item
    item = {
        "id": test_user["id"],
        "username": test_user["username"],
        "email": test_user["email"],
        "password_hash": password_hash,
        "full_name": test_user["full_name"],
        "role": test_user["role"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": datetime.now(timezone.utc).isoformat(),
    }

    # Put item in table
    try:
        table.put_item(Item=item)
        print(f"✅ Created test user: {test_user['username']}")
        print(f"   Email: {test_user['email']}")
        print(f"   Password: {test_user['password']}")
        print(f"   ID: {test_user['id']}")
        return test_user
    except Exception as e:
        print(f"❌ Failed to create test user: {e}")
        return None


if __name__ == "__main__":
    seed_test_user()
