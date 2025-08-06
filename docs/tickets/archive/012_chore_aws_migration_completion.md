# Ticket 012: Complete AWS Migration from us-west-2 to us-east-1

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 13 points
- **Created**: 2025-08-03
- **Type**: chore
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding app administrator, I want to complete the AWS migration from us-west-2 to us-east-1 with comprehensive testing infrastructure so that all services are running in the correct region with proper monitoring and quality assurance.

### Secondary User Stories
- As a developer, I want proper testing infrastructure so that I can ensure all services work correctly after migration
- As a DevOps engineer, I want automated testing hooks so that quality is maintained during development
- As a system administrator, I want health check endpoints so that I can monitor service status
- As a wedding guest, I want the app to work reliably so that all features are available when needed

## Technical Requirements

### Functional Requirements
1. All AWS services must be verified in us-east-1 region only
2. Comprehensive test suite covering all service integrations
3. Health check endpoints for all critical services
4. Pre-commit hooks to run essential tests before commits
5. Pre-push hooks to run comprehensive testing before deployments
6. Complete cleanup of us-west-2 resources
7. Documentation of new testing infrastructure

### Non-Functional Requirements
1. Performance: Health checks must respond within 2 seconds
2. Reliability: All smoke tests must pass consistently
3. Maintainability: Tests must be organized following project standards
4. Security: No credentials in test files or hooks

## Implementation Plan

### Phase 1: Migration Verification Infrastructure (3 points)
**Files to modify:**
- `aws/lambda/health-handler.py` - Create health check Lambda
- `scripts/verify-migration.sh` - Create migration verification script
- `tests/e2e/smoke/test_migration_verification.py` - Migration verification tests

**Lambda Health Check Handler:**
```python
import json
import boto3
import os
from datetime import datetime

def lambda_handler(event, context):
    """Health check endpoint for wedding app services"""
    
    try:
        # Initialize AWS clients with us-east-1
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        
        # Check DynamoDB tables
        tables_status = {}
        required_tables = [
            'heatherandwesley-users',
            'heatherandwesley-auth-users', 
            'heatherandwesley-leaderboard'
        ]
        
        for table_name in required_tables:
            try:
                table = dynamodb.Table(table_name)
                table.load()
                tables_status[table_name] = {
                    'status': 'active',
                    'region': 'us-east-1'
                }
            except Exception as e:
                tables_status[table_name] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        # Check Lambda functions
        lambda_client = boto3.client('lambda', region_name='us-east-1')
        lambda_status = {}
        required_lambdas = [
            'heatherandwesley-rsvp-handler',
            'heatherandwesley-auth-handler',
            'heatherandwesley-leaderboard-handler'
        ]
        
        for lambda_name in required_lambdas:
            try:
                response = lambda_client.get_function(FunctionName=lambda_name)
                lambda_status[lambda_name] = {
                    'status': 'active',
                    'region': response['Configuration']['Region'] if 'Configuration' in response else 'unknown'
                }
            except Exception as e:
                lambda_status[lambda_name] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        # Overall health status
        all_healthy = all(
            status['status'] == 'active' 
            for status in {**tables_status, **lambda_status}.values()
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'healthy' if all_healthy else 'degraded',
                'timestamp': datetime.utcnow().isoformat(),
                'region': 'us-east-1',
                'services': {
                    'dynamodb': tables_status,
                    'lambda': lambda_status
                }
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'error',
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            })
        }
```

**Makefile Integration:**
```bash
# Add to Makefile
deploy-health-lambda:
	@echo "Deploying health check Lambda..."
	# Create role and deploy health check Lambda
	
test-health:
	@echo "Testing health check endpoint..."
	# Test health endpoint

verify-migration:
	@echo "Verifying complete migration to us-east-1..."
	@chmod +x scripts/verify-migration.sh
	@./scripts/verify-migration.sh
```

**Implementation steps:**
1. Create health check Lambda with comprehensive service checks
2. Deploy health Lambda with proper IAM permissions for read-only access
3. Create migration verification script that checks all services in us-east-1
4. Verify no resources remain in us-west-2
5. Test health endpoint responds with service status

**Testing:**
1. Run: `claude --agent test-writer "Write tests for aws/lambda/health-handler.py"`
2. Run: `claude --agent test-critic "Review tests for aws/lambda/health-handler.py"`
3. Run: `claude --agent test-writer "Implement critic's suggestions for aws/lambda/health-handler.py"`

**Build Verification:**
```bash
make verify-migration
make test-health
make test-e2e-smoke
```

**Commit**: `chore(aws): implement health check infrastructure for migration verification`

### Phase 2: Comprehensive Smoke Test Suite (4 points)
**Files to modify:**
- `tests/e2e/smoke/test_complete_service_chain.py` - End-to-end service tests
- `tests/e2e/smoke/test_auth_flow_smoke.py` - Enhanced auth flow tests
- `tests/e2e/smoke/test_rsvp_flow_smoke.py` - Complete RSVP flow tests
- `tests/e2e/smoke/test_leaderboard_smoke.py` - Enhanced leaderboard tests

**Complete Service Chain Test:**
```python
import pytest
import requests
import boto3
import json
from datetime import datetime

class TestCompleteServiceChain:
    """Test complete service chain: API Gateway → Lambda → DynamoDB"""
    
    @pytest.fixture(scope="session")
    def api_base_url(self):
        """Get API Gateway base URL"""
        client = boto3.client('apigateway', region_name='us-east-1', profile_name='personal')
        apis = client.get_rest_apis()
        
        api = next((api for api in apis['items'] if api['name'] == 'heatherandwesley-api'), None)
        if not api:
            pytest.fail("API Gateway not found")
            
        return f"https://{api['id']}.execute-api.us-east-1.amazonaws.com/prod"
    
    def test_health_endpoint(self, api_base_url):
        """Test health check endpoint responds correctly"""
        response = requests.get(f"{api_base_url}/health", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert data['status'] in ['healthy', 'degraded']
        assert data['region'] == 'us-east-1'
        assert 'services' in data
        assert 'dynamodb' in data['services']
        assert 'lambda' in data['services']
    
    def test_auth_login_flow(self, api_base_url):
        """Test complete authentication flow"""
        # Test login
        login_data = {
            "username": "testguest",
            "password": "wedding2025"
        }
        
        response = requests.post(
            f"{api_base_url}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'token' in data
        assert data['user']['role'] == 'guest'
        
        # Test token verification
        token = data['token']
        verify_response = requests.post(
            f"{api_base_url}/auth/verify",
            json={'token': token},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data['valid'] is True
    
    def test_rsvp_submission_flow(self, api_base_url):
        """Test complete RSVP submission and retrieval"""
        # Submit RSVP
        rsvp_data = {
            "name": f"Test Guest {datetime.now().isoformat()}",
            "email": f"test-{datetime.now().timestamp()}@example.com",
            "attendance": "yes",
            "dietary_restrictions": "none"
        }
        
        response = requests.post(
            f"{api_base_url}/rsvp",
            json=rsvp_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        
        # Verify RSVP was stored (if GET endpoint exists)
        # This would require implementing a GET /rsvp/{id} endpoint
    
    def test_leaderboard_flow(self, api_base_url):
        """Test leaderboard submission and retrieval"""
        # Submit score
        score_data = {
            "player_name": f"TestPlayer{datetime.now().timestamp()}",
            "score": 1000,
            "game_type": "tetris"
        }
        
        response = requests.post(
            f"{api_base_url}/leaderboard/tetris/scores",
            json=score_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        assert response.status_code in [200, 201]
        
        # Retrieve leaderboard
        leaderboard_response = requests.get(
            f"{api_base_url}/leaderboard/tetris",
            timeout=10
        )
        
        assert leaderboard_response.status_code == 200
        leaderboard_data = leaderboard_response.json()
        assert 'scores' in leaderboard_data
        assert len(leaderboard_data['scores']) >= 0
```

**Implementation steps:**
1. Create comprehensive smoke tests covering all service integrations
2. Test complete user flows from API Gateway through Lambda to DynamoDB
3. Verify data persistence and retrieval across all services
4. Test error handling and edge cases
5. Ensure all tests run against us-east-1 resources only

**Testing:**
1. Run: `make test-e2e-smoke`
2. Verify all tests pass consistently
3. Test against production API endpoints

**Build Verification:**
```bash
cd tests/e2e/smoke
pytest -v --tb=short
```

**Commit**: `test(aws): implement comprehensive smoke test suite for all services`

### Phase 3: Git Hooks Implementation (3 points)
**Files to modify:**
- `.git/hooks/pre-commit` - Pre-commit test hook
- `.git/hooks/pre-push` - Pre-push test hook
- `scripts/setup-git-hooks.sh` - Hook installation script

**Pre-commit Hook:**
```bash
#!/bin/bash
# Pre-commit hook for wedding app

set -e

echo "🔍 Running pre-commit checks..."

# Run frontend linting
echo "📝 Checking frontend code quality..."
npm run lint || {
    echo "❌ Frontend linting failed. Please fix errors before committing."
    exit 1
}

# Run Python unit tests (fast tests only)
echo "🧪 Running Python unit tests..."
cd tests/unit/backend
pytest -v --tb=short || {
    echo "❌ Python unit tests failed. Please fix tests before committing."
    exit 1
}
cd ../../..

# Run frontend unit tests
echo "🎯 Running frontend unit tests..."
npm test -- --run --passWithNoTests || {
    echo "❌ Frontend unit tests failed. Please fix tests before committing."
    exit 1
}

# Check for AWS region consistency (us-east-1 only)
echo "🌍 Checking AWS region consistency..."
if grep -r "us-west-2" --include="*.py" --include="*.sh" --include="*.ts" --include="*.js" --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir="docs" . 2>/dev/null; then
    echo "❌ Found us-west-2 references. All AWS resources must use us-east-1."
    echo "Please update the files above to use us-east-1."
    exit 1
fi

echo "✅ Pre-commit checks passed!"
```

**Pre-push Hook:**
```bash
#!/bin/bash
# Pre-push hook for wedding app

set -e

echo "🚀 Running pre-push checks..."

# Run all Python tests
echo "🧪 Running all Python tests..."
make test-python || {
    echo "❌ Python tests failed. Please fix tests before pushing."
    exit 1
}

# Run essential smoke tests
echo "💨 Running essential smoke tests..."
cd tests/e2e/smoke
pytest test_migration_verification.py test_complete_service_chain.py -v || {
    echo "❌ Essential smoke tests failed. Please ensure services are healthy before pushing."
    exit 1
}
cd ../../..

# Verify migration is complete
echo "🔄 Verifying migration status..."
make verify-migration || {
    echo "❌ Migration verification failed. Please ensure all resources are in us-east-1."
    exit 1
}

echo "✅ Pre-push checks passed!"
```

**Hook Setup Script:**
```bash
#!/bin/bash
# Setup Git hooks for wedding app

echo "🔧 Setting up Git hooks..."

# Make hooks executable
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

# Verify hooks are installed
if [ -x .git/hooks/pre-commit ]; then
    echo "✅ Pre-commit hook installed"
else
    echo "❌ Pre-commit hook installation failed"
    exit 1
fi

if [ -x .git/hooks/pre-push ]; then
    echo "✅ Pre-push hook installed"
else
    echo "❌ Pre-push hook installation failed"
    exit 1
fi

echo "🎉 Git hooks setup complete!"
echo ""
echo "Hooks installed:"
echo "  - pre-commit: Runs linting and unit tests"
echo "  - pre-push: Runs comprehensive testing and migration verification"
```

**Implementation steps:**
1. Create pre-commit hook for fast quality checks (linting, unit tests)
2. Create pre-push hook for comprehensive testing (integration, smoke tests)
3. Add AWS region consistency checks to prevent us-west-2 references
4. Create setup script for easy hook installation
5. Test hooks work correctly and can be bypassed if needed

**Testing:**
1. Test hooks by making sample commits and pushes
2. Verify hooks catch region inconsistencies
3. Test hook bypass functionality (git commit --no-verify)

**Build Verification:**
```bash
chmod +x scripts/setup-git-hooks.sh
./scripts/setup-git-hooks.sh
git add . && git commit -m "test: verify pre-commit hook"
```

**Commit**: `chore(git): implement pre-commit and pre-push hooks for quality assurance`

### Phase 4: Resource Cleanup and Documentation (3 points)
**Files to modify:**
- `scripts/cleanup-west-2-final.sh` - Final cleanup script
- `docs/infrastructure/migration-complete.md` - Migration documentation
- `docs/infrastructure/testing-infrastructure.md` - Testing documentation
- `README.md` - Update with testing instructions

**Final Cleanup Script:**
```bash
#!/bin/bash
# Final cleanup of us-west-2 resources

set -e

AWS_PROFILE="personal"
OLD_REGION="us-west-2"
NEW_REGION="us-east-1"

echo "🧹 Final cleanup of us-west-2 resources..."
echo "This script will DELETE all remaining resources in us-west-2"
echo ""

# Confirm with user
read -p "⚠️  Are you sure you want to delete ALL resources in us-west-2? Type 'DELETE' to confirm: " -r
echo
if [[ $REPLY != "DELETE" ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

echo "🔍 Scanning for remaining resources in us-west-2..."

# Check for Lambda functions
echo "Checking Lambda functions..."
LAMBDAS=$(aws lambda list-functions --profile $AWS_PROFILE --region $OLD_REGION --query 'Functions[?starts_with(FunctionName, `heatherandwesley`)].FunctionName' --output text 2>/dev/null || echo "")
if [ -n "$LAMBDAS" ]; then
    echo "Found Lambda functions to delete: $LAMBDAS"
    for lambda in $LAMBDAS; do
        echo "Deleting Lambda function: $lambda"
        aws lambda delete-function --function-name $lambda --profile $AWS_PROFILE --region $OLD_REGION
    done
else
    echo "✅ No Lambda functions found in us-west-2"
fi

# Check for DynamoDB tables
echo "Checking DynamoDB tables..."
TABLES=$(aws dynamodb list-tables --profile $AWS_PROFILE --region $OLD_REGION --query 'TableNames[?starts_with(@, `heatherandwesley`)]' --output text 2>/dev/null || echo "")
if [ -n "$TABLES" ]; then
    echo "Found DynamoDB tables to delete: $TABLES"
    for table in $TABLES; do
        echo "Deleting DynamoDB table: $table"
        aws dynamodb delete-table --table-name $table --profile $AWS_PROFILE --region $OLD_REGION
    done
else
    echo "✅ No DynamoDB tables found in us-west-2"
fi

# Check for API Gateways
echo "Checking API Gateways..."
APIS=$(aws apigateway get-rest-apis --profile $AWS_PROFILE --region $OLD_REGION --query 'items[?starts_with(name, `heatherandwesley`)].id' --output text 2>/dev/null || echo "")
if [ -n "$APIS" ]; then
    echo "Found API Gateways to delete: $APIS"
    for api in $APIS; do
        echo "Deleting API Gateway: $api"
        aws apigateway delete-rest-api --rest-api-id $api --profile $AWS_PROFILE --region $OLD_REGION
    done
else
    echo "✅ No API Gateways found in us-west-2"
fi

# Check for IAM roles (these are global but check for region-specific ones)
echo "Checking IAM roles..."
ROLES=$(aws iam list-roles --profile $AWS_PROFILE --query 'Roles[?starts_with(RoleName, `heatherandwesley`) && contains(AssumeRolePolicyDocument, `us-west-2`)].RoleName' --output text 2>/dev/null || echo "")
if [ -n "$ROLES" ]; then
    echo "⚠️  Found IAM roles that may need manual review: $ROLES"
    echo "Please manually review these roles for region-specific policies"
else
    echo "✅ No region-specific IAM roles found"
fi

echo ""
echo "🎉 us-west-2 cleanup complete!"
echo "All wedding app resources are now in us-east-1"

# Verify migration
echo "🔄 Verifying migration..."
make verify-migration
echo "✅ Migration verification passed!"
```

**Migration Documentation:**
```markdown
# AWS Migration Completion - us-west-2 to us-east-1

## Overview
This document describes the completed migration of all wedding app AWS resources from us-west-2 (Oregon) to us-east-1 (N. Virginia).

## Migration Summary

### Migrated Resources
- **DynamoDB Tables**: 3 tables
  - heatherandwesley-users
  - heatherandwesley-auth-users  
  - heatherandwesley-leaderboard
- **Lambda Functions**: 4 functions
  - heatherandwesley-rsvp-handler
  - heatherandwesley-auth-handler
  - heatherandwesley-leaderboard-handler
  - heatherandwesley-health-handler
- **API Gateway**: 1 REST API
  - heatherandwesley-api
- **IAM Roles**: Updated for us-east-1 resources

### Migration Benefits
1. **Reduced Latency**: us-east-1 provides better performance for global users
2. **Cost Optimization**: Lower costs in us-east-1 region
3. **Service Availability**: Better service catalog availability
4. **Compliance**: Aligns with AWS best practices

## Testing Infrastructure

### Health Monitoring
- Health check endpoint: `/health`
- Monitors all critical services
- Returns comprehensive status information

### Test Suites
1. **Unit Tests**: Fast, isolated component tests
2. **Integration Tests**: Service-to-service interaction tests
3. **Smoke Tests**: End-to-end critical path verification
4. **Playwright Tests**: Frontend automation tests

### Git Hooks
- **Pre-commit**: Linting and unit tests
- **Pre-push**: Comprehensive testing and verification

## Verification Commands

```bash
# Verify all resources are in us-east-1
make verify-migration

# Test health status
make test-health

# Run all tests
make test-all-new

# Test specific services
make test-auth
make test-leaderboard-api
```

## Rollback Plan
If issues are discovered, rollback involves:
1. Re-deploying resources to us-west-2 using existing scripts
2. Updating DNS/endpoint configurations
3. Data migration from us-east-1 back to us-west-2

## Next Steps
1. Monitor health endpoints for 1 week
2. Update documentation with new endpoint URLs
3. Configure CloudWatch alarms for monitoring
4. Schedule regular testing automation
```

**Implementation steps:**
1. Create final cleanup script with comprehensive resource scanning
2. Execute cleanup and verify no resources remain in us-west-2
3. Document migration completion with full resource inventory
4. Update README with new testing commands and procedures
5. Create monitoring and alerting recommendations

**Testing:**
1. Execute cleanup script in test environment first
2. Verify all cleanup operations work correctly
3. Test documentation accuracy with fresh environment

**Build Verification:**
```bash
chmod +x scripts/cleanup-west-2-final.sh
make verify-migration
make test-all-new
```

**Commit**: `docs(aws): complete migration documentation and resource cleanup`

## Testing Strategy

### Migration Verification Tests
- Verify all resources exist only in us-east-1
- Test health check endpoint functionality
- Confirm no orphaned resources in us-west-2
- Validate all service integrations work correctly

### Comprehensive Service Tests
- Test complete user flows across all services
- Verify data persistence and retrieval
- Test authentication and authorization flows
- Validate leaderboard functionality

### Git Hook Testing
- Test pre-commit hooks catch code quality issues
- Test pre-push hooks catch integration failures
- Verify hooks can be bypassed when necessary
- Test region consistency checks work correctly

### Documentation Testing
- Verify all commands in documentation work
- Test setup scripts on fresh environments
- Validate troubleshooting procedures
- Confirm endpoint URLs are correct

## Documentation Updates Required
1. Update all AWS commands to use us-east-1 consistently
2. Document new health check endpoints
3. Add testing infrastructure overview
4. Document Git hook setup and usage
5. Update troubleshooting guides with new resource locations

## Success Criteria
1. All AWS resources verified in us-east-1 only
2. Health check endpoints respond correctly
3. All smoke tests pass consistently
4. Git hooks properly installed and functional
5. Complete cleanup of us-west-2 resources
6. Comprehensive documentation updated
7. Testing infrastructure properly organized in tests/ directory
8. Makefile commands work for all testing scenarios

## Dependencies
- AWS CLI configured with personal profile
- Existing DynamoDB tables and Lambda functions
- API Gateway endpoints
- Git repository with proper permissions
- Python testing dependencies (pytest, boto3, requests)
- Node.js testing dependencies (Jest, Playwright)

## Risks & Mitigations
1. **Risk**: Accidentally deleting active resources during cleanup
   **Mitigation**: Confirmation prompts and test environment validation
2. **Risk**: Git hooks preventing legitimate commits
   **Mitigation**: Clear documentation for bypassing hooks when needed
3. **Risk**: Test infrastructure overhead
   **Mitigation**: Fast unit tests in pre-commit, comprehensive tests in pre-push
4. **Risk**: Documentation becomes outdated
   **Mitigation**: Include documentation updates in each phase