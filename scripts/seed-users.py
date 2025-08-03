#!/usr/bin/env python3
"""
DynamoDB User Seeder for Wedding App
Seeds test users in the heatherandwesley-users DynamoDB table

This script creates test users with different roles for testing the authentication system.
It includes proper password hashing with SHA256+salt matching auth-handler.py implementation.
"""

import argparse
import boto3
import hashlib
import json
import logging
import os
import sys
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Any, Optional
from botocore.exceptions import ClientError, NoCredentialsError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UserSeeder:
    """Seed test users in DynamoDB table"""
    
    def __init__(self, profile_name: str = 'personal', region: str = 'us-east-1'):
        """
        Initialize the user seeder with AWS credentials
        
        Args:
            profile_name: AWS profile name
            region: AWS region
        """
        try:
            # Initialize boto3 session with profile
            session = boto3.Session(profile_name=profile_name, region_name=region)
            self.dynamodb = session.resource('dynamodb')
            self.dynamodb_client = session.client('dynamodb')
            logger.info(f"Initialized DynamoDB client with profile '{profile_name}' in region '{region}'")
        except (NoCredentialsError, ClientError) as e:
            logger.error(f"Failed to initialize AWS client: {e}")
            logger.error("Please ensure your AWS credentials are configured correctly")
            raise
        except Exception as e:
            logger.error(f"Unexpected error initializing DynamoDB client: {e}")
            raise
    
    def _hash_password(self, password: str) -> str:
        """
        Hash password using SHA256 with salt (matching auth-handler.py implementation)
        
        Args:
            password: Plain text password
            
        Returns:
            SHA256 hashed password with salt as string (format: salt:hash)
        """
        salt = os.urandom(32).hex()  # 32 bytes salt
        password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return f"{salt}:{password_hash}"
    
    def _verify_password(self, password: str, stored_hash: str) -> bool:
        """
        Verify password against stored hash (for testing purposes)
        
        Args:
            password: Plain text password
            stored_hash: Stored hash in format salt:hash
            
        Returns:
            True if password matches, False otherwise
        """
        try:
            salt, password_hash = stored_hash.split(':')
            return hashlib.sha256((password + salt).encode()).hexdigest() == password_hash
        except ValueError:
            return False
    
    def _get_current_timestamp(self) -> str:
        """
        Get current timestamp in ISO 8601 format with Z suffix
        
        Returns:
            ISO timestamp string
        """
        return datetime.utcnow().isoformat() + 'Z'
    
    def _float_to_decimal(self, obj: Any) -> Any:
        """
        Convert float values to Decimal for DynamoDB compatibility
        
        Args:
            obj: Object that may contain float values
            
        Returns:
            Object with floats converted to Decimal
        """
        if isinstance(obj, float):
            return Decimal(str(obj))
        elif isinstance(obj, dict):
            return {k: self._float_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._float_to_decimal(v) for v in obj]
        return obj
    
    def _decimal_to_float(self, obj: Any) -> Any:
        """
        Convert Decimal values to float for JSON serialization compatibility
        
        Args:
            obj: Object that may contain Decimal values
            
        Returns:
            Object with Decimals converted to float
        """
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: self._decimal_to_float(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._decimal_to_float(v) for v in obj]
        return obj
    
    def check_table_exists(self, table_name: str) -> bool:
        """
        Check if DynamoDB table exists
        
        Args:
            table_name: Name of the table to check
            
        Returns:
            True if table exists, False otherwise
        """
        try:
            self.dynamodb_client.describe_table(TableName=table_name)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                return False
            raise
    
    def create_auth_table(self, table_name: str, dry_run: bool = False) -> bool:
        """
        Create DynamoDB table for user authentication
        
        Args:
            table_name: Name of the table to create
            dry_run: If True, only show what would be created
            
        Returns:
            True if table was created or already exists, False otherwise
        """
        if dry_run:
            logger.info(f"[DRY RUN] Would create authentication table: {table_name}")
            logger.info("[DRY RUN] Table schema:")
            logger.info("[DRY RUN]   Primary Key: username (String)")
            logger.info("[DRY RUN]   Billing Mode: PAY_PER_REQUEST")
            logger.info("[DRY RUN]   Encryption: Enabled")
            logger.info("[DRY RUN]   Fields: username, password_hash, email, full_name, role, created_at, last_login")
            return True
        
        try:
            # Table configuration for authentication
            table_definition = {
                'TableName': table_name,
                'KeySchema': [
                    {
                        'AttributeName': 'username',
                        'KeyType': 'HASH'  # Partition key
                    }
                ],
                'AttributeDefinitions': [
                    {
                        'AttributeName': 'username',
                        'AttributeType': 'S'  # String
                    }
                ],
                'BillingMode': 'PAY_PER_REQUEST',
                'SSESpecification': {
                    'Enabled': True
                },
                'Tags': [
                    {
                        'Key': 'Name',
                        'Value': 'Wedding App Authentication Users'
                    },
                    {
                        'Key': 'Description',
                        'Value': 'Stores user authentication data for wedding app'
                    },
                    {
                        'Key': 'Environment',
                        'Value': 'Production'
                    }
                ]
            }
            
            logger.info(f"Creating authentication table: {table_name}")
            self.dynamodb_client.create_table(**table_definition)
            
            # Wait for table to be created
            logger.info("Waiting for table to be active...")
            waiter = self.dynamodb_client.get_waiter('table_exists')
            waiter.wait(TableName=table_name, WaiterConfig={'Delay': 5, 'MaxAttempts': 120})
            
            logger.info(f"Successfully created table: {table_name}")
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceInUseException':
                logger.info(f"Table {table_name} already exists")
                return True
            else:
                logger.error(f"Failed to create table {table_name}: {e}")
                return False
        except Exception as e:
            logger.error(f"Unexpected error creating table {table_name}: {e}")
            return False
    
    def check_user_exists(self, table_name: str, username: str) -> bool:
        """
        Check if a user already exists in the table
        
        Args:
            table_name: Name of the DynamoDB table
            username: Username to check
            
        Returns:
            True if user exists, False otherwise
        """
        try:
            table = self.dynamodb.Table(table_name)
            response = table.get_item(Key={'username': username})
            return 'Item' in response
        except ClientError as e:
            logger.error(f"Error checking if user {username} exists: {e}")
            return False
    
    def create_user(
        self,
        table_name: str,
        username: str,
        password: str,
        email: str,
        full_name: str,
        role: str = 'guest',
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new user in the DynamoDB table
        
        Args:
            table_name: Name of the DynamoDB table
            username: Unique username
            password: Plain text password (will be hashed)
            email: User's email address
            full_name: User's full name
            role: User role ('guest', 'vip', 'admin')
            dry_run: If True, only show what would be created
            
        Returns:
            Dictionary containing user data that was/would be created
        """
        # Validate role (matching ticket schema)
        valid_roles = ['guest', 'vip', 'admin']
        if role not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")
        
        # Validate required fields match DynamoDB schema from ticket
        if not username or not isinstance(username, str):
            raise ValueError("Username must be a non-empty string")
        if not password or not isinstance(password, str):
            raise ValueError("Password must be a non-empty string")
        if not email or not isinstance(email, str):
            raise ValueError("Email must be a non-empty string")
        if not full_name or not isinstance(full_name, str):
            raise ValueError("Full name must be a non-empty string")
        
        # Hash password
        password_hash = self._hash_password(password)
        current_time = self._get_current_timestamp()
        
        # Prepare user item (exact schema from ticket)
        user_item = {
            'username': username,
            'password_hash': password_hash,
            'email': email,
            'full_name': full_name,
            'role': role,
            'created_at': current_time,
            'last_login': ''  # Empty for new users (will be updated on first login)
        }
        
        # Convert any float values to Decimal for DynamoDB
        user_item = self._float_to_decimal(user_item)
        
        if dry_run:
            logger.info(f"[DRY RUN] Would create user: {username}")
            # Verify password hashing works correctly in dry run
            if self._verify_password(password, password_hash):
                logger.info(f"[DRY RUN] Password hashing verification: PASSED for {username}")
            else:
                logger.error(f"[DRY RUN] Password hashing verification: FAILED for {username}")
            
            # Don't include password hash in dry run output for security
            safe_item = {k: v for k, v in user_item.items() if k != 'password_hash'}
            safe_item['password_hash'] = '[REDACTED]'
            return safe_item
        
        try:
            # Check if user already exists
            if self.check_user_exists(table_name, username):
                logger.warning(f"User {username} already exists, skipping creation")
                return user_item
            
            # Create user in DynamoDB
            table = self.dynamodb.Table(table_name)
            table.put_item(Item=user_item)
            
            logger.info(f"Successfully created user: {username} ({role})")
            return user_item
            
        except ClientError as e:
            logger.error(f"Failed to create user {username}: {e}")
            raise
    
    def seed_default_users(
        self,
        table_name: str,
        dry_run: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Seed the default test users
        
        Args:
            table_name: Name of the DynamoDB table
            dry_run: If True, only show what would be created
            
        Returns:
            List of user dictionaries that were/would be created
        """
        default_users = [
            {
                'username': 'testguest',
                'password': 'wedding2025',
                'email': 'testguest@example.com',
                'full_name': 'Test Guest User',
                'role': 'guest'
            },
            {
                'username': 'testvip',
                'password': 'maui2025',
                'email': 'testvip@example.com',
                'full_name': 'Test VIP User',
                'role': 'vip'
            },
            {
                'username': 'testadmin',
                'password': 'admin2025',
                'email': 'testadmin@example.com',
                'full_name': 'Test Admin User',
                'role': 'admin'
            }
        ]
        
        created_users = []
        
        for user_data in default_users:
            try:
                created_user = self.create_user(
                    table_name=table_name,
                    dry_run=dry_run,
                    **user_data
                )
                created_users.append(created_user)
            except Exception as e:
                logger.error(f"Failed to create user {user_data['username']}: {e}")
                continue
        
        return created_users
    
    def seed_custom_users(
        self,
        table_name: str,
        users_file: str,
        dry_run: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Seed users from a JSON file
        
        Args:
            table_name: Name of the DynamoDB table
            users_file: Path to JSON file containing user data
            dry_run: If True, only show what would be created
            
        Returns:
            List of user dictionaries that were/would be created
        """
        try:
            with open(users_file, 'r') as f:
                users_data = json.load(f)
            
            if not isinstance(users_data, list):
                raise ValueError("JSON file must contain an array of user objects")
            
            created_users = []
            
            for user_data in users_data:
                # Validate required fields
                required_fields = ['username', 'password', 'email', 'full_name']
                for field in required_fields:
                    if field not in user_data:
                        raise ValueError(f"Missing required field '{field}' in user data")
                
                # Set default role if not provided
                user_data.setdefault('role', 'guest')
                
                try:
                    created_user = self.create_user(
                        table_name=table_name,
                        dry_run=dry_run,
                        **user_data
                    )
                    created_users.append(created_user)
                except Exception as e:
                    logger.error(f"Failed to create user {user_data['username']}: {e}")
                    continue
            
            return created_users
            
        except FileNotFoundError:
            logger.error(f"Users file not found: {users_file}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in users file: {e}")
            raise
    
    def list_users(self, table_name: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        List existing users in the table
        
        Args:
            table_name: Name of the DynamoDB table
            limit: Maximum number of users to return
            
        Returns:
            List of user dictionaries (without password hashes)
        """
        try:
            table = self.dynamodb.Table(table_name)
            response = table.scan(Limit=limit)
            
            users = []
            for item in response.get('Items', []):
                # Convert Decimal to native types and remove password hash for security
                safe_item = self._decimal_to_float({k: v for k, v in item.items() if k != 'password_hash'})
                users.append(safe_item)
            
            return users
            
        except ClientError as e:
            logger.error(f"Failed to list users: {e}")
            raise


def main():
    """Main function to run the user seeder"""
    parser = argparse.ArgumentParser(
        description='Seed test users in DynamoDB table for Wedding App authentication',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Seed default test users (dry run)
  %(prog)s --dry-run

  # Create table and seed default test users
  %(prog)s --create-table

  # Seed users from custom JSON file
  %(prog)s --users-file custom_users.json --create-table

  # List existing users
  %(prog)s --list-users

  # Use different AWS profile and region
  %(prog)s --profile staging --region us-east-1

  # Use existing table with different name
  %(prog)s --table-name heatherandwesley-users

JSON File Format:
  [
    {
      "username": "user1",
      "password": "password123",
      "email": "user1@example.com",
      "full_name": "User One",
      "role": "guest"
    },
    ...
  ]

Supported Roles:
  - guest: Basic wedding guest access
  - vip: VIP guest with additional privileges
  - admin: Administrative access
        """
    )
    
    # Table configuration
    parser.add_argument(
        '--table-name',
        default='heatherandwesley-auth-users',
        help='DynamoDB table name for authentication (default: heatherandwesley-auth-users)'
    )
    
    # AWS configuration
    parser.add_argument(
        '--profile',
        default='personal',
        help='AWS profile name (default: personal)'
    )
    
    parser.add_argument(
        '--region',
        default='us-east-1',
        help='AWS region (default: us-east-1)'
    )
    
    # Seeding options
    parser.add_argument(
        '--users-file',
        help='JSON file containing custom users to seed'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be created without actually creating users'
    )
    
    parser.add_argument(
        '--skip-default',
        action='store_true',
        help='Skip creating default test users'
    )
    
    parser.add_argument(
        '--create-table',
        action='store_true',
        help='Create the authentication table if it does not exist'
    )
    
    # Query options
    parser.add_argument(
        '--list-users',
        action='store_true',
        help='List existing users in the table'
    )
    
    parser.add_argument(
        '--limit',
        type=int,
        default=50,
        help='Maximum number of users to list (default: 50)'
    )
    
    # Logging
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--validate-hashing',
        action='store_true',
        help='Test password hashing functionality without creating users'
    )
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        # Initialize seeder
        seeder = UserSeeder(profile_name=args.profile, region=args.region)
        
        # Test password hashing if requested
        if args.validate_hashing:
            logger.info("Testing password hashing functionality...")
            test_passwords = ['test123', 'wedding2025', 'maui2025', 'admin2025']
            
            for test_pass in test_passwords:
                hashed = seeder._hash_password(test_pass)
                is_valid = seeder._verify_password(test_pass, hashed)
                logger.info(f"Password '{test_pass}': {'PASS' if is_valid else 'FAIL'}")
            
            logger.info("Password hashing validation completed")
            return
        
        # Check if table exists and create if requested
        if not seeder.check_table_exists(args.table_name):
            if args.create_table:
                logger.info(f"Table '{args.table_name}' does not exist, creating...")
                if not seeder.create_auth_table(args.table_name, dry_run=args.dry_run):
                    logger.error("Failed to create table")
                    sys.exit(1)
            else:
                logger.error(f"Table '{args.table_name}' does not exist")
                logger.error("Use --create-table to create it, or ensure the table exists before running this script")
                sys.exit(1)
        
        # List users if requested
        if args.list_users:
            logger.info(f"Listing users in table: {args.table_name}")
            users = seeder.list_users(args.table_name, limit=args.limit)
            
            if not users:
                logger.info("No users found in table")
            else:
                logger.info(f"Found {len(users)} users:")
                for i, user in enumerate(users):
                    if args.verbose:
                        logger.info(f"  User {i+1} fields: {list(user.keys())}")
                    username = user.get('username', 'unknown')
                    role = user.get('role', 'unknown')
                    email = user.get('email', 'no email')
                    created_at = user.get('created_at', 'unknown')
                    logger.info(f"  - {username} ({role}) - {email} - created: {created_at}")
            
            return
        
        # Seed users
        total_created = 0
        
        # Seed default users unless skipped
        if not args.skip_default:
            logger.info("Seeding default test users...")
            created_users = seeder.seed_default_users(args.table_name, dry_run=args.dry_run)
            total_created += len(created_users)
            
            if args.dry_run:
                logger.info(f"[DRY RUN] Would create {len(created_users)} default users")
            else:
                logger.info(f"Created {len(created_users)} default users")
        
        # Seed custom users if file provided
        if args.users_file:
            logger.info(f"Seeding users from file: {args.users_file}")
            created_users = seeder.seed_custom_users(args.table_name, args.users_file, dry_run=args.dry_run)
            total_created += len(created_users)
            
            if args.dry_run:
                logger.info(f"[DRY RUN] Would create {len(created_users)} custom users")
            else:
                logger.info(f"Created {len(created_users)} custom users")
        
        # Summary
        if args.dry_run:
            logger.info(f"[DRY RUN] Total users that would be created: {total_created}")
            logger.info("Run without --dry-run to actually create the users")
        else:
            logger.info(f"User seeding completed! Total users processed: {total_created}")
            
            # Show credentials for created users
            if not args.skip_default and total_created > 0:
                logger.info("\nDefault test user credentials:")
                logger.info("  testguest / wedding2025 (guest role)")
                logger.info("  testvip / maui2025 (vip role)")  
                logger.info("  testadmin / admin2025 (admin role)")
        
    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"User seeding failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()