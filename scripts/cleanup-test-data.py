#!/usr/bin/env python3
"""
Clean up test data from DynamoDB tables
Removes test entries created during test runs to prevent data accumulation
"""

import argparse
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List

import boto3

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Test data patterns to clean up
TEST_PATTERNS = {
    "heatherandwesley-users": {
        "prefixes": ["test-", "smoke-", "e2e-"],
        "emails": ["test@example.com", "lambda@test.com"],
        "id_patterns": ["test_", "testuser_", "smoketest"],
    },
    "heatherandwesley-auth-users": {
        "prefixes": ["test", "smoke", "e2e"],
        "usernames": [
            "testuser",
            "smoketest-user",
            "testguest",
            "testvip",
            "testadmin",
        ],
    },
    "heatherandwesley-leaderboard": {
        "games": ["tetris-test", "typing-test"],
        "username_patterns": ["test", "smoke"],
    },
}


def get_dynamodb_resource(profile: str, region: str):
    """Get DynamoDB resource with specified profile and region"""
    session = boto3.Session(profile_name=profile, region_name=region)
    return session.resource("dynamodb")


def clean_users_table(table, dry_run: bool = False) -> int:
    """Clean test data from users table (RSVPs)"""
    count = 0
    patterns = TEST_PATTERNS["heatherandwesley-users"]

    # Scan for test entries
    response = table.scan()
    items = response.get("Items", [])

    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    for item in items:
        should_delete = False

        # Check ID patterns
        item_id = item.get("id", "")
        for prefix in patterns["prefixes"]:
            if item_id.startswith(prefix):
                should_delete = True
                break

        # Check email patterns
        email = item.get("email", "")
        if email in patterns["emails"] or any(
            pattern in email for pattern in ["test_", "@test.", "@example."]
        ):
            should_delete = True

        # Check name patterns
        name = item.get("name", "").lower()
        if any(pattern in name for pattern in ["test ", "smoke", "e2e"]):
            should_delete = True

        if should_delete:
            count += 1
            if dry_run:
                logger.info(f"[DRY RUN] Would delete: {item_id} ({email})")
            else:
                try:
                    table.delete_item(Key={"id": item_id})
                    logger.info(f"Deleted: {item_id} ({email})")
                except Exception as e:
                    logger.error(f"Failed to delete {item_id}: {e}")

    return count


def clean_auth_users_table(table, dry_run: bool = False) -> int:
    """Clean test data from auth users table"""
    count = 0
    patterns = TEST_PATTERNS["heatherandwesley-auth-users"]

    # Check specific test usernames
    for username in patterns["usernames"]:
        try:
            response = table.get_item(Key={"username": username})
            if "Item" in response:
                count += 1
                if dry_run:
                    logger.info(f"[DRY RUN] Would delete auth user: {username}")
                else:
                    table.delete_item(Key={"username": username})
                    logger.info(f"Deleted auth user: {username}")
        except Exception as e:
            logger.debug(f"No user found or error for {username}: {e}")

    # Scan for pattern-based usernames
    response = table.scan()
    items = response.get("Items", [])

    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    for item in items:
        username = item.get("username", "")
        for prefix in patterns["prefixes"]:
            if username.startswith(prefix) and username not in [
                "testguest",
                "testvip",
                "testadmin",
            ]:
                count += 1
                if dry_run:
                    logger.info(f"[DRY RUN] Would delete auth user: {username}")
                else:
                    try:
                        table.delete_item(Key={"username": username})
                        logger.info(f"Deleted auth user: {username}")
                    except Exception as e:
                        logger.error(f"Failed to delete {username}: {e}")
                break

    return count


def clean_leaderboard_table(table, dry_run: bool = False) -> int:
    """Clean test data from leaderboard table"""
    count = 0
    patterns = TEST_PATTERNS["heatherandwesley-leaderboard"]

    # Clean test games
    for game in patterns["games"]:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("game").eq(game)
        )
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            response = table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key("game").eq(game),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        for item in items:
            count += 1
            if dry_run:
                logger.info(
                    f"[DRY RUN] Would delete score: {game} - {item.get('username', 'unknown')}"
                )
            else:
                try:
                    table.delete_item(
                        Key={"game": game, "score_timestamp": item["score_timestamp"]}
                    )
                    logger.info(
                        f"Deleted score: {game} - {item.get('username', 'unknown')}"
                    )
                except Exception as e:
                    logger.error(f"Failed to delete score: {e}")

    # Clean scores from test users in real games
    for game in ["tetris", "typing"]:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("game").eq(game)
        )
        items = response.get("Items", [])

        for item in items:
            username = item.get("username", "").lower()
            if any(pattern in username for pattern in patterns["username_patterns"]):
                count += 1
                if dry_run:
                    logger.info(
                        f"[DRY RUN] Would delete test score: {game} - {username}"
                    )
                else:
                    try:
                        table.delete_item(
                            Key={
                                "game": game,
                                "score_timestamp": item["score_timestamp"],
                            }
                        )
                        logger.info(f"Deleted test score: {game} - {username}")
                    except Exception as e:
                        logger.error(f"Failed to delete score: {e}")

    return count


def clean_old_test_data(
    table, table_name: str, days: int = 7, dry_run: bool = False
) -> int:
    """Clean test data older than specified days"""
    count = 0
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    response = table.scan()
    items = response.get("Items", [])

    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    for item in items:
        # Check various timestamp fields
        timestamp_fields = ["created_at", "updated_at", "last_login", "timestamp"]
        item_date = None

        for field in timestamp_fields:
            if field in item:
                try:
                    timestamp_str = item[field]
                    if isinstance(timestamp_str, str):
                        item_date = datetime.fromisoformat(
                            timestamp_str.replace("Z", "+00:00")
                        )
                        break
                except Exception:
                    continue

        if item_date and item_date < cutoff_date:
            # Check if it's test data
            is_test_data = False

            if table_name == "heatherandwesley-users":
                email = item.get("email", "")
                name = item.get("name", "").lower()
                if "test" in email or "test" in name or "@example." in email:
                    is_test_data = True
            elif table_name == "heatherandwesley-auth-users":
                username = item.get("username", "").lower()
                if "test" in username:
                    is_test_data = True

            if is_test_data:
                count += 1
                if dry_run:
                    logger.info(f"[DRY RUN] Would delete old test data: {item}")
                else:
                    # Determine key for deletion
                    if "id" in item:
                        table.delete_item(Key={"id": item["id"]})
                    elif "username" in item:
                        table.delete_item(Key={"username": item["username"]})
                    logger.info(f"Deleted old test data")

    return count


def main():
    parser = argparse.ArgumentParser(
        description="Clean up test data from DynamoDB tables"
    )
    parser.add_argument("--profile", default="personal", help="AWS profile to use")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without deleting",
    )
    parser.add_argument(
        "--old-days",
        type=int,
        default=7,
        help="Delete test data older than this many days",
    )
    parser.add_argument(
        "--tables", nargs="+", help="Specific tables to clean (default: all)"
    )

    args = parser.parse_args()

    # Get DynamoDB resource
    dynamodb = get_dynamodb_resource(args.profile, args.region)

    # Tables to clean
    tables_to_clean = args.tables or list(TEST_PATTERNS.keys())

    total_deleted = 0

    for table_name in tables_to_clean:
        if table_name not in TEST_PATTERNS:
            logger.warning(f"Unknown table: {table_name}")
            continue

        try:
            table = dynamodb.Table(table_name)
            logger.info(f"\nCleaning table: {table_name}")

            # Clean based on patterns
            if table_name == "heatherandwesley-users":
                count = clean_users_table(table, args.dry_run)
            elif table_name == "heatherandwesley-auth-users":
                count = clean_auth_users_table(table, args.dry_run)
            elif table_name == "heatherandwesley-leaderboard":
                count = clean_leaderboard_table(table, args.dry_run)
            else:
                count = 0

            # Clean old test data
            old_count = clean_old_test_data(
                table, table_name, args.old_days, args.dry_run
            )
            count += old_count

            total_deleted += count
            logger.info(
                f"{'Would delete' if args.dry_run else 'Deleted'} {count} items from {table_name}"
            )

        except Exception as e:
            logger.error(f"Error cleaning {table_name}: {e}")

    logger.info(
        f"\nTotal items {'that would be deleted' if args.dry_run else 'deleted'}: {total_deleted}"
    )

    if args.dry_run:
        logger.info(
            "\nThis was a dry run. Use without --dry-run to actually delete items."
        )


if __name__ == "__main__":
    main()
