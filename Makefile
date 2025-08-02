# Wedding App AWS Infrastructure Management
# Uses AWS CLI for infrastructure management and AWS profile 'personal'

# Variables
AWS_PROFILE := personal
AWS_REGION := us-west-2
TABLE_NAME := heatherandwesley-users
AUTH_TABLE_NAME := heatherandwesley-auth-users
LAMBDA_NAME := heatherandwesley-rsvp-handler
AUTH_LAMBDA_NAME := heatherandwesley-auth-handler
API_NAME := heatherandwesley-api
JWT_SECRET := your-secret-key-change-in-production

# Default target
.DEFAULT_GOAL := help

# Help command
help:
	@echo "Wedding App AWS Infrastructure Management"
	@echo ""
	@echo "OpenTofu Infrastructure Operations:"
	@echo "  make tofu-init          Initialize OpenTofu configuration"
	@echo "  make tofu-plan          Show planned infrastructure changes"
	@echo "  make tofu-apply         Apply infrastructure changes"
	@echo "  make tofu-destroy       Destroy infrastructure (with confirmation)"
	@echo "  make tofu-validate      Validate OpenTofu configuration"
	@echo "  make tofu-fmt           Format OpenTofu configuration files"
	@echo ""
	@echo "DynamoDB Operations:"
	@echo "  make create-table       Create DynamoDB table via OpenTofu"
	@echo "  make update-table       Update table configuration via OpenTofu"
	@echo "  make delete-table       Delete table (with confirmation)"
	@echo "  make describe-table     Show table status and schema"
	@echo "  make list-tables        List all DynamoDB tables"
	@echo ""
	@echo "Lambda Operations:"
	@echo "  make deploy-lambda      Deploy Lambda function via OpenTofu"
	@echo "  make update-lambda      Update Lambda function code"
	@echo "  make test-lambda        Test Lambda function with sample data"
	@echo "  make delete-lambda      Delete Lambda function"
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
	@echo "API Gateway Operations:"
	@echo "  make deploy-api         Deploy API Gateway configuration via OpenTofu"
	@echo "  make update-api         Update API Gateway settings"
	@echo "  make test-api           Test API Gateway endpoints"
	@echo "  make delete-api         Delete API Gateway"
	@echo ""
	@echo "Full Stack Operations:"
	@echo "  make deploy-all         Deploy all infrastructure via OpenTofu"
	@echo "  make test-all           Test complete integration chain"
	@echo "  make cleanup-all        Delete all AWS resources via OpenTofu (with confirmation)"
	@echo ""
	@echo "Schema Management:"
	@echo "  make update-schemas     Update all API schemas and documentation"
	@echo "  make test-api-consistency  Test field consistency across layers"

# OpenTofu Infrastructure Operations
tofu-init:
	@echo "Initializing OpenTofu configuration..."
	cd infrastructure && tofu init

tofu-plan:
	@echo "Planning infrastructure changes..."
	cd infrastructure && ./tofu-wrapper.sh plan -var="aws_profile=$(AWS_PROFILE)" -var="aws_region=$(AWS_REGION)"

tofu-apply:
	@echo "Applying infrastructure changes..."
	cd infrastructure && ./tofu-wrapper.sh apply -var="aws_profile=$(AWS_PROFILE)" -var="aws_region=$(AWS_REGION)" -auto-approve

tofu-destroy:
	@echo "WARNING: This will destroy all infrastructure!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		cd infrastructure && ./tofu-wrapper.sh destroy -var="aws_profile=$(AWS_PROFILE)" -var="aws_region=$(AWS_REGION)"; \
	fi

tofu-validate:
	@echo "Validating OpenTofu configuration..."
	cd infrastructure && tofu validate

tofu-fmt:
	@echo "Formatting OpenTofu configuration files..."
	cd infrastructure && tofu fmt -recursive

# DynamoDB Operations
create-table: tofu-apply
	@echo "DynamoDB table created via OpenTofu"

update-table: tofu-apply
	@echo "DynamoDB table updated via OpenTofu"

delete-table: tofu-destroy
	@echo "DynamoDB table deleted via OpenTofu"

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
deploy-lambda: tofu-apply
	@echo "Lambda function deployed via OpenTofu"

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

delete-lambda: tofu-destroy
	@echo "Lambda function deleted via OpenTofu"

# API Gateway Operations
deploy-api: tofu-apply
	@echo "API Gateway deployed via OpenTofu"

update-api: tofu-apply
	@echo "API Gateway updated via OpenTofu"

test-api:
	@echo "Testing API Gateway endpoints..."
	@API_URL=$$(cd infrastructure && tofu output -raw api_gateway_url 2>/dev/null) && \
	if [ -n "$$API_URL" ]; then \
		echo "Testing POST /rsvp endpoint at $$API_URL/rsvp"; \
		curl -X POST $$API_URL/rsvp \
			-H "Content-Type: application/json" \
			-d '{"name":"Test Guest","email":"test@example.com","attendance":"yes"}'; \
	else \
		echo "API Gateway URL not found. Run 'make deploy-api' first."; \
	fi

delete-api: tofu-destroy
	@echo "API Gateway deleted via OpenTofu"

# Full Stack Operations
deploy-all:
	@echo "Deploying all infrastructure..."
	$(MAKE) tofu-init
	$(MAKE) tofu-apply
	@echo "All infrastructure deployed successfully!"

test-all:
	@echo "Testing complete integration chain..."
	$(MAKE) describe-table
	$(MAKE) test-lambda
	$(MAKE) test-api
	@echo "All tests completed!"

cleanup-all:
	@echo "WARNING: This will delete ALL AWS resources!"
	@read -p "Are you absolutely sure? Type 'DELETE' to confirm: " -r; \
	echo; \
	if [[ $$REPLY == "DELETE" ]]; then \
		$(MAKE) tofu-destroy; \
	else \
		echo "Cleanup cancelled."; \
	fi

# Terraform fallback commands (use if OpenTofu has issues)
tf-init:
	@echo "Initializing Terraform configuration..."
	cd infrastructure && terraform init

tf-plan:
	@echo "Planning infrastructure changes with Terraform..."
	cd infrastructure && terraform plan -var="aws_profile=$(AWS_PROFILE)" -var="aws_region=$(AWS_REGION)"

tf-apply:
	@echo "Applying infrastructure changes with Terraform..."
	cd infrastructure && terraform apply -var="aws_profile=$(AWS_PROFILE)" -var="aws_region=$(AWS_REGION)" -auto-approve

tf-deploy-all:
	@echo "Deploying all infrastructure with Terraform..."
	$(MAKE) tf-init
	$(MAKE) tf-apply
	@echo "All infrastructure deployed successfully!"

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
	@API_URL=$$(aws apigateway get-rest-apis --profile $(AWS_PROFILE) --region $(AWS_REGION) --query "items[?name=='$(API_NAME)'].id" --output text 2>/dev/null) && \
	if [ -n "$$API_URL" ]; then \
		API_BASE="https://$$API_URL.execute-api.$(AWS_REGION).amazonaws.com/prod"; \
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
	@API_URL=$$(aws apigateway get-rest-apis --profile $(AWS_PROFILE) --region $(AWS_REGION) --query "items[?name=='$(API_NAME)'].id" --output text 2>/dev/null) && \
	if [ -n "$$API_URL" ]; then \
		echo "  POST https://$$API_URL.execute-api.$(AWS_REGION).amazonaws.com/prod/auth/login"; \
		echo "  POST https://$$API_URL.execute-api.$(AWS_REGION).amazonaws.com/prod/auth/verify"; \
		echo "  POST https://$$API_URL.execute-api.$(AWS_REGION).amazonaws.com/prod/auth/register"; \
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

# Development helpers
.PHONY: help tofu-init tofu-plan tofu-apply tofu-destroy tofu-validate tofu-fmt \
        create-table update-table delete-table describe-table list-tables \
        deploy-lambda update-lambda test-lambda delete-lambda \
        deploy-api update-api test-api delete-api \
        deploy-all test-all cleanup-all \
        tf-init tf-plan tf-apply tf-deploy-all \
        update-schemas test-api-consistency \
        create-auth-table describe-auth-table create-auth-lambda-role deploy-auth-lambda \
        deploy-auth-api seed-users test-auth deploy-auth-all delete-auth \
        test-unit-python test-unit-frontend test-integration-python \
        test-e2e-playwright test-e2e-smoke test-python test-frontend test-all-new