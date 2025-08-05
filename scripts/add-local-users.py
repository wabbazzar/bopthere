#!/usr/bin/env python3
"""
Add Local Users to DynamoDB
Reads users from local/users.json and adds them to the DynamoDB authentication table.

This script is specifically designed to add users from the local/users.json file
which contains sensitive user data and should never be committed to version control.
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# Add the scripts directory to the path so we can import from seed-users.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import UserSeeder from seed-users.py (using importlib for hyphenated filename)
import importlib.util

spec = importlib.util.spec_from_file_location(
    "seed_users", os.path.join(os.path.dirname(__file__), "seed-users.py")
)
seed_users_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed_users_module)
UserSeeder = seed_users_module.UserSeeder

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def main():
    """Main function to add local users to DynamoDB"""
    parser = argparse.ArgumentParser(
        description="Add users from local/users.json to DynamoDB authentication table",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Add users from local/users.json (dry run)
  %(prog)s --dry-run

  # Add users to DynamoDB table
  %(prog)s

  # Use different AWS profile
  %(prog)s --profile staging

  # Use different table name
  %(prog)s --table-name heatherandwesley-users

Note: This script reads from local/users.json which should contain:
[
  {
    "username": "user1",
    "password": "password123",
    "email": "user1@example.com",
    "full_name": "User One",
    "role": "admin"
  }
]
        """,
    )

    # Table configuration
    parser.add_argument(
        "--table-name",
        default="heatherandwesley-auth-users",
        help="DynamoDB table name for authentication (default: heatherandwesley-auth-users)",
    )

    # AWS configuration
    parser.add_argument(
        "--profile", default="personal", help="AWS profile name (default: personal)"
    )

    parser.add_argument(
        "--region", default="us-east-1", help="AWS region (default: us-east-1)"
    )

    # Options
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be created without actually creating users",
    )

    parser.add_argument(
        "--create-table",
        action="store_true",
        help="Create the authentication table if it does not exist",
    )

    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    parser.add_argument(
        "--users-file",
        default="local/users.json",
        help="Path to users JSON file (default: local/users.json)",
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        # Check if users file exists
        users_file_path = Path(args.users_file)
        if not users_file_path.exists():
            logger.error(f"Users file not found: {users_file_path}")
            logger.error("Please create the users.json file with user data to add")
            sys.exit(1)

        # Initialize seeder
        seeder = UserSeeder(profile_name=args.profile, region=args.region)

        # Check if table exists and create if requested
        if not seeder.check_table_exists(args.table_name):
            if args.create_table:
                logger.info(f"Table '{args.table_name}' does not exist, creating...")
                if not seeder.create_auth_table(args.table_name, dry_run=args.dry_run):
                    logger.error("Failed to create table")
                    sys.exit(1)
            else:
                logger.error(f"Table '{args.table_name}' does not exist")
                logger.error(
                    "Use --create-table to create it, or ensure the table exists before running this script"
                )
                sys.exit(1)

        # Load and validate users from JSON file
        logger.info(f"Loading users from: {users_file_path}")

        try:
            with open(users_file_path, "r") as f:
                users_data = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in users file: {e}")
            sys.exit(1)

        if not isinstance(users_data, list):
            logger.error("Users file must contain an array of user objects")
            sys.exit(1)

        if not users_data:
            logger.warning("No users found in users file")
            return

        logger.info(f"Found {len(users_data)} users to process")

        # Process each user
        created_users = []
        failed_users = []

        for i, user_data in enumerate(users_data):
            try:
                # Validate required fields
                required_fields = ["username", "password", "email", "full_name"]
                missing_fields = [
                    field for field in required_fields if field not in user_data
                ]

                if missing_fields:
                    logger.error(
                        f"User {i+1}: Missing required fields: {', '.join(missing_fields)}"
                    )
                    failed_users.append(user_data.get("username", f"user_{i+1}"))
                    continue

                # Set default role if not provided
                user_data.setdefault("role", "guest")

                # Create user
                if args.dry_run:
                    logger.info(
                        f"[DRY RUN] Would create user: {user_data['username']} ({user_data['role']})"
                    )
                    # Test password hashing
                    test_hash = seeder._hash_password(user_data["password"])
                    if seeder._verify_password(user_data["password"], test_hash):
                        logger.info(
                            f"[DRY RUN] Password hashing verification: PASSED for {user_data['username']}"
                        )
                    else:
                        logger.error(
                            f"[DRY RUN] Password hashing verification: FAILED for {user_data['username']}"
                        )
                else:
                    created_user = seeder.create_user(
                        table_name=args.table_name, dry_run=args.dry_run, **user_data
                    )
                    created_users.append(created_user)
                    logger.info(
                        f"✓ Successfully created user: {user_data['username']} ({user_data['role']})"
                    )

            except Exception as e:
                logger.error(
                    f"Failed to create user {user_data.get('username', f'user_{i+1}')}: {e}"
                )
                failed_users.append(user_data.get("username", f"user_{i+1}"))
                continue

        # Summary
        if args.dry_run:
            logger.info(f"\n[DRY RUN] Summary:")
            logger.info(
                f"  Users that would be created: {len(users_data) - len(failed_users)}"
            )
            logger.info(f"  Users that would fail: {len(failed_users)}")
            if failed_users:
                logger.info(f"  Failed users: {', '.join(failed_users)}")
            logger.info("Run without --dry-run to actually create the users")
        else:
            logger.info(f"\nSummary:")
            logger.info(f"  Successfully created: {len(created_users)} users")
            logger.info(f"  Failed: {len(failed_users)} users")

            if created_users:
                logger.info("\nCreated users:")
                for user in created_users:
                    logger.info(
                        f"  - {user['username']} ({user['role']}) - {user['email']}"
                    )

            if failed_users:
                logger.warning(f"\nFailed users: {', '.join(failed_users)}")

        # Test login for created users (if not dry run)
        if not args.dry_run and created_users:
            logger.info("\nPassword verification test:")
            for user_data in users_data:
                if user_data["username"] not in failed_users:
                    # Test that we can verify the password
                    stored_hash = seeder._hash_password(user_data["password"])
                    is_valid = seeder._verify_password(
                        user_data["password"], stored_hash
                    )
                    status = "✓ PASS" if is_valid else "✗ FAIL"
                    logger.info(f"  {user_data['username']}: {status}")

    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to add local users: {e}")
        if args.verbose:
            import traceback

            logger.error(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
