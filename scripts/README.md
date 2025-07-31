# Scripts Directory

This directory contains utility scripts for the Wedding App project.

## seed-users.py

Seeds test users in DynamoDB for the authentication system.

### Quick Start

```bash
# Create authentication table and seed default test users
python scripts/seed-users.py --create-table

# Preview what would be created (dry run)
python scripts/seed-users.py --dry-run --create-table

# List existing users
python scripts/seed-users.py --list-users
```

### Default Test Users

The script creates these default test users:

- **testguest** / wedding2025 (guest role)
- **testvip** / maui2025 (vip role)  
- **testadmin** / admin2025 (admin role)

### Custom Users

Create a JSON file with custom users:

```json
[
  {
    "username": "user1",
    "password": "password123",
    "email": "user1@example.com",
    "full_name": "User One",
    "role": "guest"
  }
]
```

Then seed them:

```bash
python scripts/seed-users.py --users-file custom_users.json --create-table
```

### User Roles

- **guest**: Basic wedding guest access
- **vip**: VIP guest with additional privileges  
- **admin**: Administrative access

### Environment Configuration

The script uses these AWS settings by default:
- Profile: `personal`
- Region: `us-west-2`
- Table: `heatherandwesley-auth-users`

Override with command line options:

```bash
python scripts/seed-users.py --profile staging --region us-east-1 --table-name my-auth-table
```

### Dependencies

The script requires these Python packages:
- `boto3` - AWS SDK for Python
- `bcrypt` - Password hashing library

Install with:
```bash
pip install boto3 bcrypt
```

### Security Notes

- Passwords are hashed with bcrypt before storage
- The script includes dry-run functionality to preview changes
- Existing users are not overwritten
- Password hashes are never displayed in logs or output

## Other Scripts

- `generate_dynamodb_schemas.py`: Extracts and documents DynamoDB table schemas
- `extract_api_gateway_routes.py`: Extracts API Gateway route information
- `extract_lambda_patterns.py`: Analyzes Lambda function patterns