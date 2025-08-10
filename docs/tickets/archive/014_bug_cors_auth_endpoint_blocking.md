# Ticket 014: Fix CORS Authentication Blocking Due to API Gateway Mismatch

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 8 points
- **Created**: 2025-08-05
- **Type**: bug
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding guest, I want to log in to the wedding app so that I can access RSVP functionality and character-specific content without being blocked by CORS errors.

### Secondary User Stories
- As a developer, I want the authentication API endpoints to be properly configured so that frontend authentication works across all environments
- As a wedding guest, I want consistent API endpoints so that authentication works reliably from any device
- As the wedding couple, I want guests to have seamless access to the wedding app without technical barriers

## Technical Requirements

### Functional Requirements
1. Authentication endpoints must be accessible from frontend applications without CORS errors
2. API Gateway must properly route `/auth/login`, `/auth/verify`, and `/auth/register` endpoints
3. CORS headers must be configured for all authentication endpoints including preflight OPTIONS requests
4. Frontend must use the correct API Gateway ID for authentication requests
5. All authentication flows must work across Wesley, Heather, and Puffy character perspectives

### Non-Functional Requirements
1. Performance: Authentication requests must complete within 2 seconds
2. Accessibility: Error messages must be clear and accessible to screen readers
3. Character Theming: Authentication errors must respect character-specific styling

## Problem Analysis

### Root Cause
Two separate API Gateway instances exist:
- **API Gateway ID `4q7jj56io8`** (newer): Contains only leaderboard endpoints
- **API Gateway ID `emwkjk2c9d`** (older): Contains auth endpoints (`/auth/login`, `/auth/verify`, `/auth/register`)

The frontend is configured to use the newer API Gateway ID but auth endpoints only exist on the older gateway.

### Current Error
```
Access to fetch at 'https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod/auth/login' 
from origin 'http://localhost:8080' has been blocked by CORS policy: Response to preflight 
request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present 
on the requested resource.
```

### API Gateway Analysis
**Newer Gateway (`4q7jj56io8`):**
- Name: "heatherandwesley-api"
- Description: "Wedding App API including leaderboard endpoints"
- Resources: `/leaderboard/{game}` only

**Older Gateway (`emwkjk2c9d`):**
- Name: "heatherandwesley-api" 
- Description: "Wedding App API Gateway"
- Resources: `/auth/login`, `/auth/verify`, `/auth/register`, `/rsvp`, `/leaderboard/tetris`, `/leaderboard/typing`

## Implementation Plan

### Phase 1: Consolidate Auth Endpoints to New Gateway (3 points)
**Files to modify:**
- AWS API Gateway configuration via AWS CLI
- Update environment variables in Lambda configurations

**Implementation steps:**
1. Add auth resource to newer API Gateway (`4q7jj56io8`)
```bash
# Create /auth resource on new gateway
aws apigateway create-resource \
  --rest-api-id 4q7jj56io8 \
  --parent-id bunwg94jx3 \
  --path-part auth \
  --profile personal \
  --region us-east-1
```

2. Create login endpoint with proper CORS configuration
```bash
# Get the auth resource ID from step 1, then create login endpoint
aws apigateway create-resource \
  --rest-api-id 4q7jj56io8 \
  --parent-id [AUTH_RESOURCE_ID] \
  --path-part login \
  --profile personal \
  --region us-east-1

# Add POST method for login
aws apigateway put-method \
  --rest-api-id 4q7jj56io8 \
  --resource-id [LOGIN_RESOURCE_ID] \
  --http-method POST \
  --authorization-type NONE \
  --profile personal \
  --region us-east-1

# Add OPTIONS method for CORS preflight
aws apigateway put-method \
  --rest-api-id 4q7jj56io8 \
  --resource-id [LOGIN_RESOURCE_ID] \
  --http-method OPTIONS \
  --authorization-type NONE \
  --profile personal \
  --region us-east-1
```

3. Configure Lambda integration for auth endpoints
```bash
# Get Lambda function ARN
AUTH_LAMBDA_ARN=$(aws lambda get-function \
  --function-name heatherandwesley-auth-handler \
  --query 'Configuration.FunctionArn' \
  --output text \
  --profile personal \
  --region us-east-1)

# Create integration for POST /auth/login
aws apigateway put-integration \
  --rest-api-id 4q7jj56io8 \
  --resource-id [LOGIN_RESOURCE_ID] \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${AUTH_LAMBDA_ARN}/invocations" \
  --profile personal \
  --region us-east-1
```

4. Configure CORS responses with proper headers
```bash
# Configure OPTIONS response for CORS preflight
aws apigateway put-method-response \
  --rest-api-id 4q7jj56io8 \
  --resource-id [LOGIN_RESOURCE_ID] \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true" \
  --profile personal \
  --region us-east-1

# Configure integration response for OPTIONS
aws apigateway put-integration-response \
  --rest-api-id 4q7jj56io8 \
  --resource-id [LOGIN_RESOURCE_ID] \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers='Content-Type,Authorization',method.response.header.Access-Control-Allow-Methods='GET,POST,OPTIONS',method.response.header.Access-Control-Allow-Origin='*'" \
  --response-templates '{"application/json":""}' \
  --profile personal \
  --region us-east-1
```

5. Repeat steps 2-4 for `/auth/verify` and `/auth/register` endpoints

**Testing:**
```bash
# Test auth endpoint creation
claude "Use the test-writer agent to create E2E smoke tests for auth endpoints that verify API Gateway → Lambda → DynamoDB integration on the new gateway"
```

**Commit**: `fix(auth): consolidate auth endpoints to new API Gateway with CORS`

### Phase 2: Update Lambda Permissions (2 points) 
**Files to modify:**
- Lambda function permissions via AWS CLI

**Implementation steps:**
1. Grant API Gateway permission to invoke auth Lambda
```bash
# Add permission for new API Gateway to invoke auth Lambda
aws lambda add-permission \
  --function-name heatherandwesley-auth-handler \
  --statement-id "allow-api-gateway-4q7jj56io8" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:*:4q7jj56io8/*/*" \
  --profile personal \
  --region us-east-1
```

2. Verify Lambda permissions are correctly configured
```bash
aws lambda get-policy \
  --function-name heatherandwesley-auth-handler \
  --profile personal \
  --region us-east-1
```

**Testing:**
```bash
# Test Lambda integration
curl -X POST https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

**Commit**: `fix(auth): add Lambda permissions for new API Gateway`

### Phase 3: Deploy and Test API Gateway (3 points)
**Files to modify:**
- API Gateway deployment configuration

**Implementation steps:**
1. Deploy the updated API Gateway configuration
```bash
# Deploy to prod stage
aws apigateway create-deployment \
  --rest-api-id 4q7jj56io8 \
  --stage-name prod \
  --description "Add auth endpoints with CORS configuration" \
  --profile personal \
  --region us-east-1
```

2. Verify all endpoints are accessible with proper CORS headers
```bash
# Test CORS preflight for login
curl -X OPTIONS https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Test actual login request
curl -X POST https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -d '{"username":"testuser","password":"testpass"}' \
  -v
```

3. Update frontend environment configuration if needed
```typescript
// Verify frontend uses correct API Gateway ID
const API_BASE_URL = 'https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod';
```

**Specialized agent usage:**
```bash
# Have code-quality-assessor review CORS configuration
claude "Use the code-quality-assessor agent to review the API Gateway CORS configuration for security and best practices"

# Have test-writer create comprehensive auth endpoint tests
claude "Use the test-writer agent to create E2E smoke tests for all auth endpoints including CORS preflight verification"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `fix(auth): deploy auth endpoints with CORS to production`

## Testing Strategy

### CORS Verification Tests
- Test preflight OPTIONS requests return proper CORS headers
- Verify actual POST requests include CORS headers in response
- Test authentication from localhost:8080 and production domains
- Validate all three auth endpoints (/login, /verify, /register) work

### Character Perspective Tests  
- Test authentication as Wesley character context
- Test authentication as Heather character context
- Test authentication as Puffy character context
- Verify character-specific error styling applies

### Cross-Origin Tests
- Test from localhost:8080 (development)
- Test from localhost:5173 (Vite dev server)
- Test from production domain
- Verify mobile browser authentication

### Integration Tests
- Complete login flow with character selection
- RSVP form access after authentication
- Token persistence across character switches
- Logout and re-authentication flows

### E2E Smoke Tests
**MANDATORY**: Each phase must include smoke tests that verify the complete Gateway → Lambda → DynamoDB flow

**Test Structure**:
```bash
# Create test file: tests/e2e/smoke/test_auth_cors_smoke.py
import os
import requests
import pytest

ENV = os.environ.get('ENV', 'prod')
API_BASE = f"https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/{ENV}"

def test_auth_cors_preflight():
    """Smoke test for CORS preflight - verifies OPTIONS method works"""
    
    response = requests.options(f"{API_BASE}/auth/login", 
        headers={
            "Origin": "http://localhost:8080",
            "Access-Control-Request-Method": "POST", 
            "Access-Control-Request-Headers": "Content-Type"
        })
    
    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" in response.headers
    assert "Access-Control-Allow-Methods" in response.headers
    assert "Access-Control-Allow-Headers" in response.headers

def test_auth_login_endpoint():
    """Smoke test for auth login - verifies Gateway → Lambda → DynamoDB flow"""
    
    # Test login request with CORS headers
    response = requests.post(f"{API_BASE}/auth/login", 
        headers={
            "Content-Type": "application/json",
            "Origin": "http://localhost:8080"
        },
        json={"username": "testguest", "password": "wedding2025"})
    
    # Should return proper response even for invalid credentials
    assert response.status_code in [200, 401]
    assert "Access-Control-Allow-Origin" in response.headers
    
    # If successful login, verify token structure
    if response.status_code == 200:
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == "testguest"

def test_auth_verify_endpoint():
    """Smoke test for auth verify - verifies token validation flow"""
    
    # First get a token (or use test token)
    login_response = requests.post(f"{API_BASE}/auth/login",
        headers={"Content-Type": "application/json"},
        json={"username": "testguest", "password": "wedding2025"})
    
    if login_response.status_code == 200:
        token = login_response.json()["token"]
        
        # Test verify endpoint
        verify_response = requests.post(f"{API_BASE}/auth/verify",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
                "Origin": "http://localhost:8080"
            })
        
        assert verify_response.status_code == 200
        assert "Access-Control-Allow-Origin" in verify_response.headers
        data = verify_response.json()
        assert data["user"]["username"] == "testguest"

# Run with: pytest tests/e2e/smoke/test_auth_cors_smoke.py -v
```

## Documentation Updates Required
1. Update API endpoint documentation with new Gateway ID
2. Document CORS configuration for future endpoint additions
3. Add troubleshooting guide for CORS issues
4. Update deployment guide with API Gateway consolidation steps

## Success Criteria
1. Authentication endpoints accessible from frontend without CORS errors
2. All three auth endpoints (/login, /verify, /register) work on new Gateway
3. CORS headers properly configured for all origins and methods
4. Frontend authentication flows work across all character perspectives
5. Mobile authentication works without browser CORS blocking

## Dependencies
- AWS API Gateway configuration
- Lambda function permissions
- Frontend environment configuration
- Existing auth Lambda handler code

## Risks & Mitigations
1. **Risk**: Breaking existing leaderboard endpoints during Gateway consolidation
   **Mitigation**: Test all endpoints after each phase, rollback plan available
2. **Risk**: CORS misconfiguration blocking legitimate requests
   **Mitigation**: Test from multiple origins during development
3. **Risk**: Lambda permission conflicts between gateways
   **Mitigation**: Careful permission management with specific source ARNs

## Deployment Guide

**CRITICAL**: This section MUST be updated by EVERY agent working on the ticket when making infrastructure changes.

### Infrastructure Changes

#### Modified AWS Resources
- **API Gateway**: `4q7jj56io8` (heatherandwesley-api)
  - Add `/auth` resource with sub-resources: `/login`, `/verify`, `/register`
  - Configure CORS for all auth endpoints
  - Set up Lambda integrations for auth methods

- **Lambda Function**: `heatherandwesley-auth-handler`
  - Add permission for new API Gateway to invoke function
  - Source ARN: `arn:aws:execute-api:us-east-1:*:4q7jj56io8/*/*`

#### Environment Variables
- No new environment variables required
- Verify existing `TABLE_NAME` and `JWT_SECRET` are accessible

#### IAM Permissions Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:*:function:heatherandwesley-auth-handler",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:execute-api:us-east-1:*:4q7jj56io8/*/*"
        }
      }
    }
  ]
}
```

### Deployment Steps

1. **API Gateway Resource Creation**:
   ```bash
   # Add auth resource to new gateway
   make add-auth-endpoints-to-gateway
   
   # Configure CORS for all auth methods
   make configure-auth-cors
   
   # Set up Lambda integrations
   make integrate-auth-lambda
   ```

2. **Lambda Permissions**:
   ```bash
   # Grant permission for new gateway
   make add-auth-lambda-permissions
   
   # Verify permissions are correct
   make verify-auth-permissions
   ```

3. **Deploy Gateway**:
   ```bash
   # Deploy updated gateway to prod
   make deploy-gateway-prod
   
   # Test all auth endpoints
   make test-auth-endpoints
   ```

### Deployment Verification

**Automated Smoke Tests**:
```bash
# Run CORS and auth endpoint smoke tests
pytest tests/e2e/smoke/test_auth_cors_smoke.py -v --env=prod

# Verify all character perspectives work
make test-auth-character-flows
```

**Manual Verification Commands**:
```bash
# Test CORS preflight
curl -X OPTIONS https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Origin: http://localhost:8080" -v

# Test auth login
curl -X POST https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -d '{"username":"test","password":"test"}' -v

# Check Lambda logs for auth requests
aws logs tail /aws/lambda/heatherandwesley-auth-handler --follow --profile personal
```

### Rollback Plan
1. **API Gateway**: Remove auth resources from new gateway
   ```bash
   aws apigateway delete-resource --rest-api-id 4q7jj56io8 --resource-id [AUTH_RESOURCE_ID] --profile personal --region us-east-1
   ```

2. **Lambda Permissions**: Remove permission for new gateway
   ```bash
   aws lambda remove-permission --function-name heatherandwesley-auth-handler --statement-id "allow-api-gateway-4q7jj56io8" --profile personal --region us-east-1
   ```

3. **Frontend**: Revert to old Gateway ID if needed
   ```typescript
   const API_BASE_URL = 'https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod';
   ```

### Production Readiness Checklist
- [ ] All auth endpoints accessible on new Gateway ID
- [ ] CORS headers properly configured for all methods
- [ ] Lambda permissions allow new Gateway invocation
- [ ] Frontend authentication flows work without CORS errors
- [ ] Character-specific authentication tested (Wesley/Heather/Puffy)
- [ ] Mobile browser authentication verified
- [ ] E2E smoke tests passing for all auth endpoints
- [ ] Error handling maintains character theming
- [ ] Performance meets requirements (<2s auth response time)
- [ ] Existing leaderboard endpoints remain functional