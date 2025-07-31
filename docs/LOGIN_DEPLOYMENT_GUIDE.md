# Login System Deployment Guide

This guide walks you through deploying and testing the authentication system for the Wedding App.

## Prerequisites

- AWS CLI configured with `personal` profile
- OpenTofu/Terraform installed
- Python 3.11+ with pip
- Node.js and npm for frontend testing

## Current Implementation Status

✅ **Backend Files Ready:**
- `aws/lambda/auth-handler.py` - Complete Lambda function with login/verify/register endpoints
- `infrastructure/lambda-auth.tf` - Complete Lambda infrastructure configuration
- `scripts/seed-users.py` - Complete user seeding script with comprehensive CLI

❌ **Missing Infrastructure:**
- `infrastructure/dynamodb-users.tf` - DynamoDB users table definition (needs creation)

❌ **Frontend Files (Phase 2):**
- Login modal and authentication context (not yet implemented)

## Phase 1: Backend Infrastructure Deployment

### Step 1: Create Missing DynamoDB Table Infrastructure

The users table infrastructure file is missing. Create it:

```bash
# Create the missing DynamoDB users table file
cat > infrastructure/dynamodb-users.tf << 'EOF'
# DynamoDB table for user authentication
resource "aws_dynamodb_table" "auth_users" {
  name         = "heatherandwesley-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"

  attribute {
    name = "username"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Wedding App Authentication Users"
    Description = "Stores user authentication data for wedding app"
    Environment = "Production"
  }
}

# Output the table name for reference
output "auth_users_table_name" {
  description = "Name of the authentication users DynamoDB table"
  value       = aws_dynamodb_table.auth_users.name
}

output "auth_users_table_arn" {
  description = "ARN of the authentication users DynamoDB table"
  value       = aws_dynamodb_table.auth_users.arn
}
EOF
```

### Step 2: Fix Lambda IAM Policy

The current `lambda-auth.tf` references the wrong DynamoDB table. Update it:

```bash
# Update the IAM policy to reference the correct table
sed -i 's/aws_dynamodb_table.rsvp_responses.arn/aws_dynamodb_table.auth_users.arn/g' infrastructure/lambda-auth.tf
sed -i 's/"${aws_dynamodb_table.rsvp_responses.arn}\/index\/\*"/"${aws_dynamodb_table.auth_users.arn}\/index\/\*"/g' infrastructure/lambda-auth.tf
```

### Step 3: Create Lambda Deployment Package

```bash
# Navigate to the Lambda directory
cd aws/lambda

# Install Python dependencies
pip install -r requirements.txt -t .

# Create deployment package
zip -r ../../infrastructure/auth-lambda-deployment.zip . -x "*.pyc" "__pycache__/*"

# Return to project root
cd ../..
```

### Step 4: Update API Gateway Configuration

Add authentication endpoints to your API Gateway. Check if `infrastructure/api-gateway-auth.tf` exists:

```bash
# If the file doesn't exist, create it
cat > infrastructure/api-gateway-auth.tf << 'EOF'
# Authentication API Gateway resources

# /auth resource
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_rest_api.wedding_api.root_resource_id
  path_part   = "auth"
}

# /auth/login resource
resource "aws_api_gateway_resource" "auth_login" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "login"
}

# /auth/verify resource
resource "aws_api_gateway_resource" "auth_verify" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "verify"
}

# /auth/register resource
resource "aws_api_gateway_resource" "auth_register" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "register"
}

# POST /auth/login
resource "aws_api_gateway_method" "auth_login_post" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_login.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_login_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_login.id
  http_method = aws_api_gateway_method.auth_login_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# POST /auth/verify
resource "aws_api_gateway_method" "auth_verify_post" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_verify.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_verify_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_verify.id
  http_method = aws_api_gateway_method.auth_verify_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# POST /auth/register
resource "aws_api_gateway_method" "auth_register_post" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_register.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_register_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_register.id
  http_method = aws_api_gateway_method.auth_register_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# CORS for /auth/login
resource "aws_api_gateway_method" "auth_login_options" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_login.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_login_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_login.id
  http_method = aws_api_gateway_method.auth_login_options.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# CORS for /auth/verify
resource "aws_api_gateway_method" "auth_verify_options" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_verify.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_verify_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_verify.id
  http_method = aws_api_gateway_method.auth_verify_options.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# CORS for /auth/register
resource "aws_api_gateway_method" "auth_register_options" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_register.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_register_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_register.id
  http_method = aws_api_gateway_method.auth_register_options.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}
EOF
```

### Step 5: Deploy Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure

# Initialize if needed
tofu init

# Plan the deployment
tofu plan

# Apply the changes
tofu apply

# Note the API Gateway URL from output
cd ..
```

### Step 6: Create and Seed Test Users

```bash
# Seed default test users
python scripts/seed-users.py --create-table --profile personal

# This creates:
# - testguest / wedding2025 (guest role)
# - testvip / maui2025 (vip role)  
# - testadmin / admin2025 (admin role)
```

## Phase 2: Backend Testing

### Test Authentication Endpoints

Get your API Gateway URL from the infrastructure output and test:

```bash
# Replace YOUR_API_URL with your actual API Gateway URL
API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com/prod"

# Test user registration
curl -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123",
    "email": "testuser@example.com",
    "full_name": "Test User",
    "role": "guest"
  }'

# Test login with default user
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testguest",
    "password": "wedding2025"
  }'

# Save the token from login response, then test verification
TOKEN="your-jwt-token-here"
curl -X POST "${API_URL}/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"${TOKEN}\"}"
```

### Check CloudWatch Logs

Monitor Lambda execution:

```bash
# View recent logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/heatherandwesley-auth-handler" --profile personal

# Tail logs (replace with your log group name)
aws logs tail "/aws/lambda/heatherandwesley-auth-handler" --follow --profile personal
```

## Phase 3: Frontend Integration (Optional)

The frontend components aren't implemented yet, but you can test the API integration manually:

### Test with Postman or Similar

1. **Login Request:**
   - Method: POST
   - URL: `https://your-api-url/auth/login`
   - Body (JSON):
     ```json
     {
       "username": "testguest",
       "password": "wedding2025"
     }
     ```

2. **Verify Token:**
   - Method: POST
   - URL: `https://your-api-url/auth/verify`
   - Body (JSON):
     ```json
     {
       "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
     }
     ```

### Test with JavaScript (Browser Console)

```javascript
// Test login from browser console
const API_URL = 'https://your-api-url';

fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'testguest',
    password: 'wedding2025'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Login response:', data);
  
  // Test token verification
  if (data.token) {
    return fetch(`${API_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: data.token
      })
    });
  }
})
.then(response => response.json())
.then(data => console.log('Verify response:', data))
.catch(error => console.error('Error:', error));
```

## Troubleshooting

### Common Issues

1. **Lambda Function Not Found**
   - Ensure the deployment zip file was created correctly
   - Check that the Lambda function was deployed with the right name

2. **DynamoDB Access Denied**
   - Verify the IAM policy references the correct table ARN
   - Check that the Lambda execution role has the right permissions

3. **API Gateway 404 Errors**
   - Ensure all API Gateway resources were created
   - Check that the deployment was triggered after adding new resources

4. **CORS Issues**
   - Verify OPTIONS methods are configured for all endpoints
   - Check that allowed origins match your frontend URL

### Debugging Commands

```bash
# Check if table exists
aws dynamodb describe-table --table-name heatherandwesley-users --profile personal

# List users in table
python scripts/seed-users.py --list-users --profile personal

# Check Lambda function
aws lambda get-function --function-name heatherandwesley-auth-handler --profile personal

# View API Gateway resources
aws apigateway get-resources --rest-api-id YOUR_API_ID --profile personal
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **JWT Secret**: The default JWT secret in `variables.tf` should be changed to a strong, unique value
2. **HTTPS Only**: Ensure your API Gateway enforces HTTPS in production
3. **Password Policy**: Consider implementing password strength requirements
4. **Rate Limiting**: Add rate limiting to prevent brute force attacks
5. **Token Expiry**: Default token expiry is 24 hours, adjust as needed

## Next Steps

Once backend testing is complete:

1. Implement frontend login components (Phase 2 of ticket)
2. Add festival app layout (Phase 3 of ticket)
3. Integrate with existing character system
4. Add comprehensive error handling and user feedback

## Test Credentials

Default test users created by the seeding script:

- **Guest User**: `testguest` / `wedding2025`
- **VIP User**: `testvip` / `maui2025`
- **Admin User**: `testadmin` / `admin2025`

These credentials can be used for initial testing of the authentication flow.