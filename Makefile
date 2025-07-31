# Wedding App AWS Infrastructure Management
# Uses OpenTofu for infrastructure as code and AWS profile 'personal'

# Variables
AWS_PROFILE := personal
AWS_REGION := us-west-2
TABLE_NAME := heatherandwesley-users
LAMBDA_NAME := heatherandwesley-rsvp-handler
API_NAME := heatherandwesley-api

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

# Development helpers
.PHONY: help tofu-init tofu-plan tofu-apply tofu-destroy tofu-validate tofu-fmt \
        create-table update-table delete-table describe-table list-tables \
        deploy-lambda update-lambda test-lambda delete-lambda \
        deploy-api update-api test-api delete-api \
        deploy-all test-all cleanup-all \
        tf-init tf-plan tf-apply tf-deploy-all