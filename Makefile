# Wedding App AWS Infrastructure Management
# Uses AWS CLI for infrastructure management and AWS profile 'personal'

# Variables
AWS_PROFILE := personal
AWS_REGION := us-east-1
TABLE_NAME := heatherandwesley-users
AUTH_TABLE_NAME := heatherandwesley-auth-users
LEADERBOARD_TABLE_NAME := heatherandwesley-leaderboard
LAMBDA_NAME := heatherandwesley-rsvp-handler
AUTH_LAMBDA_NAME := heatherandwesley-auth-handler
LEADERBOARD_LAMBDA_NAME := heatherandwesley-leaderboard-handler
HEALTH_LAMBDA_NAME := heatherandwesley-health-handler
API_NAME := heatherandwesley-api
JWT_SECRET := your-secret-key-change-in-production

# Default target
.DEFAULT_GOAL := help

# Help command
help:
	@echo "Wedding App AWS Infrastructure Management"
	@echo ""
	@echo "DynamoDB Operations:"
	@echo "  make create-rsvp-table  Create RSVP DynamoDB table"
	@echo "  make describe-table     Show table status and schema"
	@echo "  make list-tables        List all DynamoDB tables"
	@echo ""
	@echo "Lambda Operations:"
	@echo "  make update-lambda      Update Lambda function code"
	@echo "  make test-lambda        Test Lambda function with sample data"
	@echo ""
	@echo "Authentication Operations (CLI):"
	@echo "  make create-auth-table  Create authentication DynamoDB table via CLI"
	@echo "  make deploy-auth-lambda Deploy authentication Lambda via CLI"
	@echo "  make deploy-auth-api    Deploy authentication API Gateway endpoints"
	@echo "  make seed-users         Seed test users in authentication table"
	@echo "  make test-auth          Test authentication endpoints"
	@echo "  make deploy-auth-all    Deploy complete authentication system"
	@echo "  make delete-auth        Delete authentication resources"
	@echo ""
	@echo "Leaderboard Operations (CLI):"
	@echo "  make deploy-leaderboard-lambda Deploy leaderboard Lambda function"
	@echo "  make test-leaderboard   Test leaderboard Lambda function"
	@echo "  make update-leaderboard-lambda Update leaderboard Lambda code"
	@echo "  make deploy-leaderboard-api Deploy API Gateway for leaderboard"
	@echo "  make test-leaderboard-api Test leaderboard API endpoints"
	@echo ""
	@echo "API Gateway Operations:"
	@echo "  make test-api           Test API Gateway endpoints"
	@echo ""
	@echo "Full Stack Operations:"
	@echo "  make test-all           Test complete integration chain"
	@echo ""
	@echo "Health Check & Migration Operations:"
	@echo "  make deploy-health-lambda Deploy health check Lambda function"
	@echo "  make test-health        Test health check endpoint"
	@echo "  make verify-migration   Verify complete migration to us-east-1"
	@echo ""
	@echo "Schema Management:"
	@echo "  make update-schemas     Update all API schemas and documentation"
	@echo "  make test-api-consistency  Test field consistency across layers"

# DynamoDB Table Creation
create-rsvp-table:
	@echo "Creating RSVP DynamoDB table..."
	@aws dynamodb create-table \
		--table-name $(TABLE_NAME) \
		--attribute-definitions \
			AttributeName=id,AttributeType=S \
			AttributeName=email,AttributeType=S \
		--key-schema AttributeName=id,KeyType=HASH \
		--global-secondary-indexes \
			"IndexName=email-index,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL}" \
		--billing-mode PAY_PER_REQUEST \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		--output json | jq '.'
	@echo "Waiting for table to be active..."
	@aws dynamodb wait table-exists \
		--table-name $(TABLE_NAME) \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION)
	@echo "RSVP table created successfully!"

# DynamoDB Operations

describe-table:
	@echo "Describing DynamoDB table..."
	@aws dynamodb describe-table \
		--table-name $(TABLE_NAME) \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		--output json | jq '.'

list-tables:
	@echo "Listing DynamoDB tables..."
	@aws dynamodb list-tables \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		--output table

# Lambda Operations
update-lambda:
	@echo "Updating Lambda function code..."
	cd aws/lambda && zip -r ../../lambda-deployment.zip .
	@aws lambda update-function-code \
		--function-name $(LAMBDA_NAME) \
		--zip-file fileb://lambda-deployment.zip \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION)
	@rm -f lambda-deployment.zip

test-lambda:
	@echo "Testing Lambda function with sample RSVP data..."
	@aws lambda invoke \
		--function-name $(LAMBDA_NAME) \
		--payload '{"httpMethod":"POST","body":"{\"name\":\"Test Guest\",\"email\":\"test@example.com\",\"attendance\":\"yes\"}"}' \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		response.json && cat response.json && rm response.json

# API Gateway Operations

test-api:
	@echo "Testing API Gateway endpoints..."
	@API_ID=$$(aws apigateway get-rest-apis --profile $(AWS_PROFILE) --region $(AWS_REGION) --query "items[?name=='$(API_NAME)'].id" --output text 2>/dev/null | awk '{print $$NF}') && \
	if [ -n "$$API_ID" ]; then \
		API_URL="https://$$API_ID.execute-api.$(AWS_REGION).amazonaws.com/prod"; \
		echo "Testing POST /rsvp endpoint at $$API_URL/rsvp"; \
		curl -X POST $$API_URL/rsvp \
			-H "Content-Type: application/json" \
			-d '{"name":"Test Guest","email":"test@example.com","attendance":"yes"}'; \
	else \
		echo "API Gateway not found."; \
	fi

# Full Stack Operations

test-all:
	@echo "Running comprehensive service tests..."
	@chmod +x tmp/test-all-services.sh
	@./tmp/test-all-services.sh

deploy-all:
	@echo "Deploying all resources to $(AWS_REGION)..."
	@chmod +x tmp/deploy-resources.sh
	@./tmp/deploy-resources.sh

cleanup-west-2:
	@echo "WARNING: This will delete all resources in us-west-2!"
	@read -p "Are you sure? Type 'DELETE' to confirm: " -r; \
	echo; \
	if [[ $$REPLY == "DELETE" ]]; then \
		./tmp/cleanup-west-2.sh; \
	else \
		echo "Cleanup cancelled."; \
	fi


# Schema Management Operations
update-schemas: ## Update all API schemas
	@echo "Updating API schemas..."
	cd scripts && python generate_dynamodb_schemas.py
	cd scripts && python extract_api_gateway_routes.py
	cd scripts && python extract_lambda_patterns.py
	@echo "Schema update complete!"

test-api-consistency: ## Test field consistency
	@echo "Testing API field consistency..."
	cd tests/integration/backend && pytest test_api_field_consistency.py -v

# Test Operations
test-unit-python: ## Run Python unit tests
	@echo "Running Python unit tests..."
	cd tests/unit/backend && pytest -v

test-unit-frontend: ## Run frontend Jest unit tests
	@echo "Running frontend unit tests..."
	npm test

test-integration-python: ## Run Python integration tests
	@echo "Running Python integration tests..."
	cd tests/integration/backend && pytest -v

test-e2e-playwright: ## Run Playwright E2E tests
	@echo "Running Playwright E2E tests..."
	npx playwright test tests/e2e/playwright/

test-e2e-smoke: ## Run smoke tests
	@echo "Running E2E smoke tests..."
	cd tests/e2e/smoke && pytest -v

test-python: test-unit-python test-integration-python test-e2e-smoke ## Run all Python tests

test-frontend: test-unit-frontend test-e2e-playwright ## Run all frontend tests

test-all-new: test-python test-frontend ## Run all tests with new structure

# Authentication Operations (CLI-based)
create-auth-table:
	@echo "Creating authentication DynamoDB table..."
	@aws dynamodb create-table \
		--table-name $(AUTH_TABLE_NAME) \
		--attribute-definitions AttributeName=username,AttributeType=S \
		--key-schema AttributeName=username,KeyType=HASH \
		--billing-mode PAY_PER_REQUEST \
		--sse-specification Enabled=true \
		--tags Key=Name,Value="Wedding App Authentication Users" Key=Description,Value="Stores user authentication data for wedding app" \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		--output json | jq '.'
	@echo "Waiting for table to be active..."
	@aws dynamodb wait table-exists \
		--table-name $(AUTH_TABLE_NAME) \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION)
	@echo "Authentication table created successfully!"

describe-auth-table:
	@echo "Describing authentication DynamoDB table..."
	@aws dynamodb describe-table \
		--table-name $(AUTH_TABLE_NAME) \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		--output json | jq '.'

create-auth-lambda-role:
	@echo "Creating IAM role for authentication Lambda..."
	@aws iam create-role \
		--role-name $(AUTH_LAMBDA_NAME)-role \
		--assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
		--profile $(AWS_PROFILE) || echo "Role may already exist"
	@aws iam attach-role-policy \
		--role-name $(AUTH_LAMBDA_NAME)-role \
		--policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
		--profile $(AWS_PROFILE) || echo "Policy may already be attached"
	@echo "Creating DynamoDB access policy..."
	@ACCOUNT_ID=$$(aws sts get-caller-identity --profile $(AWS_PROFILE) --query Account --output text) && \
	aws iam put-role-policy \
		--role-name $(AUTH_LAMBDA_NAME)-role \
		--policy-name $(AUTH_LAMBDA_NAME)-dynamodb-policy \
		--policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["dynamodb:PutItem","dynamodb:GetItem","dynamodb:Query","dynamodb:UpdateItem"],"Resource":["arn:aws:dynamodb:$(AWS_REGION):'$$ACCOUNT_ID':table/$(AUTH_TABLE_NAME)","arn:aws:dynamodb:$(AWS_REGION):'$$ACCOUNT_ID':table/$(AUTH_TABLE_NAME)/index/*"]}]}' \
		--profile $(AWS_PROFILE) || echo "Policy may already exist"

deploy-auth-lambda: create-auth-lambda-role
	@echo "Building authentication Lambda deployment package..."
	@rm -rf build/lambda-package && mkdir -p build/lambda-package
	@cp aws/lambda/auth-handler.py build/lambda-package/
	@poetry export --format requirements.txt --output build/requirements.txt --without-hashes
	@pip install --index-url https://pypi.org/simple/ -r build/requirements.txt -t build/lambda-package/ --no-deps
	@cd build/lambda-package && zip -r ../auth-lambda-deployment.zip . -x "*.pyc" "__pycache__/*"
	@echo "Deploying authentication Lambda function..."
	@ACCOUNT_ID=$$(aws sts get-caller-identity --profile $(AWS_PROFILE) --query Account --output text) && \
	aws lambda create-function \
		--function-name $(AUTH_LAMBDA_NAME) \
		--runtime python3.11 \
		--role arn:aws:iam::$$ACCOUNT_ID:role/$(AUTH_LAMBDA_NAME)-role \
		--handler auth-handler.lambda_handler \
		--zip-file fileb://build/auth-lambda-deployment.zip \
		--timeout 30 \
		--memory-size 256 \
		--environment Variables='{TABLE_NAME=$(AUTH_TABLE_NAME),JWT_SECRET=$(JWT_SECRET)}' \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		--output json | jq '.' || \
	aws lambda update-function-code \
		--function-name $(AUTH_LAMBDA_NAME) \
		--zip-file fileb://build/auth-lambda-deployment.zip \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) && \
	aws lambda update-function-configuration \
		--function-name $(AUTH_LAMBDA_NAME) \
		--environment Variables='{TABLE_NAME=$(AUTH_TABLE_NAME),JWT_SECRET=$(JWT_SECRET)}' \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION)
	@echo "Authentication Lambda deployed successfully!"

seed-users:
	@echo "Seeding test users..."
	@poetry run python scripts/seed-users.py --create-table --profile $(AWS_PROFILE) --table-name $(AUTH_TABLE_NAME)

test-auth:
	@echo "Testing authentication endpoints..."
	@API_ID=$$(aws apigateway get-rest-apis --profile $(AWS_PROFILE) --region $(AWS_REGION) --query "items[?name=='$(API_NAME)'].id" --output text 2>/dev/null | awk '{print $$NF}') && \
	if [ -n "$$API_ID" ]; then \
		API_BASE="https://$$API_ID.execute-api.$(AWS_REGION).amazonaws.com/prod"; \
		echo "Testing login endpoint at $$API_BASE/auth/login"; \
		curl -X POST $$API_BASE/auth/login \
			-H "Content-Type: application/json" \
			-d '{"username":"testguest","password":"wedding2025"}' \
			-w "\nHTTP Status: %{http_code}\n"; \
		echo ""; \
		echo "Testing VIP login..."; \
		curl -X POST $$API_BASE/auth/login \
			-H "Content-Type: application/json" \
			-d '{"username":"testvip","password":"maui2025"}' \
			-w "\nHTTP Status: %{http_code}\n"; \
		echo ""; \
		echo "Testing admin login..."; \
		curl -X POST $$API_BASE/auth/login \
			-H "Content-Type: application/json" \
			-d '{"username":"testadmin","password":"admin2025"}' \
			-w "\nHTTP Status: %{http_code}\n"; \
	else \
		echo "API Gateway not found. Deploy API Gateway first."; \
	fi

deploy-auth-api:
	@echo "Deploying authentication API Gateway endpoints..."
	@chmod +x scripts/deploy-auth-api.sh
	@./scripts/deploy-auth-api.sh

deploy-auth-all:
	@echo "Deploying complete authentication system..."
	$(MAKE) create-auth-table
	$(MAKE) deploy-auth-lambda
	$(MAKE) deploy-auth-api
	$(MAKE) seed-users
	@echo "Authentication system deployed successfully!"
	@echo ""
	@echo "Available endpoints:"
	@API_ID=$$(aws apigateway get-rest-apis --profile $(AWS_PROFILE) --region $(AWS_REGION) --query "items[?name=='$(API_NAME)'].id" --output text 2>/dev/null | awk '{print $$NF}') && \
	if [ -n "$$API_ID" ]; then \
		echo "  POST https://$$API_ID.execute-api.$(AWS_REGION).amazonaws.com/prod/auth/login"; \
		echo "  POST https://$$API_ID.execute-api.$(AWS_REGION).amazonaws.com/prod/auth/verify"; \
		echo "  POST https://$$API_ID.execute-api.$(AWS_REGION).amazonaws.com/prod/auth/register"; \
	fi
	@echo ""
	@echo "Test credentials:"
	@echo "  testguest / wedding2025 (guest role)"
	@echo "  testvip / maui2025 (vip role)"
	@echo "  testadmin / admin2025 (admin role)"

delete-auth:
	@echo "WARNING: This will delete authentication resources!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		aws lambda delete-function --function-name $(AUTH_LAMBDA_NAME) --profile $(AWS_PROFILE) --region $(AWS_REGION) || echo "Lambda may not exist"; \
		aws iam detach-role-policy --role-name $(AUTH_LAMBDA_NAME)-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole --profile $(AWS_PROFILE) || echo "Policy may not be attached"; \
		aws iam delete-role-policy --role-name $(AUTH_LAMBDA_NAME)-role --policy-name $(AUTH_LAMBDA_NAME)-dynamodb-policy --profile $(AWS_PROFILE) || echo "Policy may not exist"; \
		aws iam delete-role --role-name $(AUTH_LAMBDA_NAME)-role --profile $(AWS_PROFILE) || echo "Role may not exist"; \
		aws dynamodb delete-table --table-name $(AUTH_TABLE_NAME) --profile $(AWS_PROFILE) --region $(AWS_REGION) || echo "Table may not exist"; \
		echo "Authentication resources deleted!"; \
	fi

# Leaderboard Operations (CLI-based)
deploy-leaderboard-lambda:
	@echo "Deploying leaderboard Lambda function..."
	@chmod +x scripts/deploy-leaderboard-lambda.sh
	@./scripts/deploy-leaderboard-lambda.sh

test-leaderboard:
	@echo "Testing leaderboard Lambda function..."
	@aws lambda invoke \
		--function-name $(LEADERBOARD_LAMBDA_NAME) \
		--payload '{"httpMethod":"GET","path":"/leaderboard/tetris"}' \
		--profile $(AWS_PROFILE) \
		response.json && cat response.json && rm response.json

update-leaderboard-lambda:
	@echo "Updating leaderboard Lambda function code..."
	@rm -rf build/lambda-package && mkdir -p build/lambda-package
	@cp aws/lambda/leaderboard-handler.py build/lambda-package/
	@cd aws/lambda && pip install --index-url https://pypi.org/simple/ -r requirements.txt -t ../../build/lambda-package/ --quiet
	@cd build/lambda-package && zip -r ../leaderboard-deployment.zip . -x "*.pyc" "__pycache__/*"
	@aws lambda update-function-code \
		--function-name $(LEADERBOARD_LAMBDA_NAME) \
		--zip-file fileb://build/leaderboard-deployment.zip \
		--profile $(AWS_PROFILE)
	@rm -rf build/lambda-package build/leaderboard-deployment.zip
	@echo "Leaderboard Lambda updated successfully!"

deploy-leaderboard-api:
	@echo "Deploying API Gateway for leaderboard..."
	@chmod +x scripts/deploy-leaderboard-api.sh
	@./scripts/deploy-leaderboard-api.sh

test-leaderboard-api:
	@echo "Testing leaderboard API endpoints..."
	@chmod +x scripts/test-leaderboard-endpoints.sh
	@./scripts/test-leaderboard-endpoints.sh

# Health Check & Migration Operations
create-health-lambda-role:
	@echo "Creating IAM role for health check Lambda..."
	@aws iam create-role \
		--role-name $(HEALTH_LAMBDA_NAME)-role \
		--assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
		--profile $(AWS_PROFILE) || echo "Role may already exist"
	@aws iam attach-role-policy \
		--role-name $(HEALTH_LAMBDA_NAME)-role \
		--policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
		--profile $(AWS_PROFILE) || echo "Policy may already be attached"
	@echo "Creating read-only access policy for health checks..."
	@ACCOUNT_ID=$$(aws sts get-caller-identity --profile $(AWS_PROFILE) --query Account --output text) && \
	aws iam put-role-policy \
		--role-name $(HEALTH_LAMBDA_NAME)-role \
		--policy-name $(HEALTH_LAMBDA_NAME)-readonly-policy \
		--policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["dynamodb:DescribeTable","lambda:GetFunction","lambda:ListFunctions","dynamodb:ListTables"],"Resource":"*"}]}' \
		--profile $(AWS_PROFILE) || echo "Policy may already exist"

deploy-health-lambda: create-health-lambda-role
	@echo "Building health check Lambda deployment package..."
	@rm -rf build/lambda-package && mkdir -p build/lambda-package
	@cp aws/lambda/health-handler.py build/lambda-package/
	@cd build/lambda-package && zip -r ../health-lambda-deployment.zip . -x "*.pyc" "__pycache__/*"
	@echo "Deploying health check Lambda function..."
	@ACCOUNT_ID=$$(aws sts get-caller-identity --profile $(AWS_PROFILE) --query Account --output text) && \
	aws lambda create-function \
		--function-name $(HEALTH_LAMBDA_NAME) \
		--runtime python3.11 \
		--role arn:aws:iam::$$ACCOUNT_ID:role/$(HEALTH_LAMBDA_NAME)-role \
		--handler health-handler.lambda_handler \
		--zip-file fileb://build/health-lambda-deployment.zip \
		--timeout 30 \
		--memory-size 256 \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION) \
		--output json | jq '.' || \
	aws lambda update-function-code \
		--function-name $(HEALTH_LAMBDA_NAME) \
		--zip-file fileb://build/health-lambda-deployment.zip \
		--profile $(AWS_PROFILE) \
		--region $(AWS_REGION)
	@echo "Health check Lambda deployed successfully!"

test-health:
	@echo "Testing health check endpoint..."
	@API_ID=$$(aws apigateway get-rest-apis --profile $(AWS_PROFILE) --region $(AWS_REGION) --query "items[?name=='$(API_NAME)'].id" --output text 2>/dev/null | awk '{print $$NF}') && \
	if [ -n "$$API_ID" ]; then \
		API_URL="https://$$API_ID.execute-api.$(AWS_REGION).amazonaws.com/prod"; \
		echo "Testing health endpoint at $$API_URL/health"; \
		curl -X GET $$API_URL/health \
			-H "Content-Type: application/json" \
			-w "\nHTTP Status: %{http_code}\n"; \
	else \
		echo "API Gateway not found. Testing Lambda directly..."; \
		aws lambda invoke \
			--function-name $(HEALTH_LAMBDA_NAME) \
			--payload '{"httpMethod":"GET","path":"/health"}' \
			--profile $(AWS_PROFILE) \
			--region $(AWS_REGION) \
			response.json && cat response.json && rm response.json; \
	fi

verify-migration:
	@echo "Verifying complete migration to us-east-1..."
	@chmod +x scripts/verify-migration.sh
	@./scripts/verify-migration.sh

# Development helpers
.PHONY: help create-rsvp-table describe-table list-tables \
        update-lambda test-lambda test-api test-all deploy-all cleanup-west-2 \
        update-schemas test-api-consistency \
        create-auth-table describe-auth-table create-auth-lambda-role deploy-auth-lambda \
        deploy-auth-api seed-users test-auth deploy-auth-all delete-auth \
        test-unit-python test-unit-frontend test-integration-python \
        test-e2e-playwright test-e2e-smoke test-python test-frontend test-all-new \
        deploy-leaderboard-lambda test-leaderboard update-leaderboard-lambda \
        deploy-leaderboard-api test-leaderboard-api \
        create-health-lambda-role deploy-health-lambda test-health verify-migration