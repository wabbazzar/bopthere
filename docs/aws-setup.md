# AWS Infrastructure Setup Guide

This guide provides detailed instructions for setting up and managing the AWS infrastructure for the wedding RSVP system.

## Overview

The wedding app uses AWS services to handle RSVP submissions:
- **DynamoDB**: Stores RSVP responses
- **Lambda**: Processes RSVP submissions
- **API Gateway**: Provides REST API endpoints
- **OpenTofu**: Manages infrastructure as code

## Prerequisites

1. **AWS CLI**: Install and configure the AWS CLI
   ```bash
   aws configure --profile personal
   ```

2. **OpenTofu**: Install OpenTofu for infrastructure management
   ```bash
   # macOS with Homebrew
   brew install opentofu
   
   # Or download from https://opentofu.org/docs/intro/install/
   ```

3. **AWS Permissions**: Ensure your AWS profile has permissions for:
   - DynamoDB (create/manage tables)
   - Lambda (create/manage functions)
   - API Gateway (create/manage APIs)
   - IAM (create roles and policies)
   - CloudWatch Logs (create log groups)

## Initial Setup

### 1. Clone and Navigate to Project
```bash
git clone <repository-url>
cd heatherandwesley
```

### 2. Initialize Infrastructure
```bash
# Initialize OpenTofu
make tofu-init

# Plan infrastructure changes (preview)
make tofu-plan

# Deploy all infrastructure
make deploy-all
```

### 3. Configure Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Get API Gateway URL from OpenTofu output
cd infrastructure && tofu output api_gateway_url

# Update .env with the API Gateway URL
# VITE_API_GATEWAY_URL=https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com/prod
```

## Infrastructure Components

### DynamoDB Table
- **Table Name**: `heatherandwesley-users`
- **Primary Key**: `id` (String)
- **Global Secondary Index**: `email-index` on `email` field
- **Billing Mode**: Pay-per-request (on-demand)
- **Features**: 
  - Point-in-time recovery enabled
  - Server-side encryption enabled

### Lambda Function
- **Function Name**: `heatherandwesley-rsvp-handler`
- **Runtime**: Python 3.11
- **Memory**: 256 MB
- **Timeout**: 30 seconds
- **Operations**:
  - POST /rsvp - Create new RSVP
  - GET /rsvp/{id} - Retrieve RSVP by ID

### API Gateway
- **API Name**: `heatherandwesley-api`
- **Endpoints**:
  - `POST /rsvp` - Submit RSVP
  - `GET /rsvp/{id}` - Get RSVP by ID
  - `OPTIONS /rsvp` - CORS preflight
- **CORS**: Enabled for all origins
- **Stage**: `prod`

## Common Operations

### Deploy Infrastructure
```bash
# Deploy everything
make deploy-all

# Deploy specific components
make create-table     # DynamoDB only
make deploy-lambda    # Lambda only
make deploy-api       # API Gateway only
```

### Update Lambda Function
```bash
# After modifying aws/lambda/rsvp-handler.py
make update-lambda
```

### Test Integration
```bash
# Test Lambda function directly
make test-lambda

# Test API Gateway endpoint
make test-api

# Test complete integration
make test-all
```

### View Resources
```bash
# List DynamoDB tables
make list-tables

# Describe RSVP table
make describe-table

# View Lambda logs (via AWS Console or CLI)
aws logs tail /aws/lambda/heatherandwesley-rsvp-handler --profile personal --follow
```

### Destroy Infrastructure
```bash
# Remove all AWS resources (CAUTION: This deletes all data)
make cleanup-all
```

## Troubleshooting

### API Gateway Returns 500 Error
1. Check Lambda logs for errors:
   ```bash
   aws logs tail /aws/lambda/heatherandwesley-rsvp-handler --profile personal --since 5m
   ```

2. Verify Lambda has DynamoDB permissions:
   ```bash
   make describe-table
   ```

3. Test Lambda directly:
   ```bash
   make test-lambda
   ```

### CORS Issues
1. Verify CORS is enabled in API Gateway
2. Check browser console for specific CORS errors
3. Ensure frontend is using correct API URL

### DynamoDB Access Denied
1. Check IAM role permissions
2. Verify table name matches environment variable
3. Ensure Lambda execution role has DynamoDB access

### Environment Variable Not Working
1. Ensure `.env` file exists in project root
2. Verify variable starts with `VITE_`
3. Restart development server after changes

## Production Considerations

### Security
- Review and restrict CORS origins for production
- Implement rate limiting on API Gateway
- Enable AWS WAF for additional protection
- Review IAM permissions for least privilege

### Monitoring
- Set up CloudWatch alarms for errors
- Enable X-Ray tracing for debugging
- Monitor DynamoDB consumed capacity
- Set up budget alerts

### Backup
- DynamoDB point-in-time recovery is enabled
- Consider regular data exports
- Document recovery procedures

### Cost Optimization
- DynamoDB is using on-demand billing
- Lambda is billed per invocation
- Monitor usage and adjust if needed
- Consider reserved capacity for predictable workloads

## Infrastructure as Code

All infrastructure is defined in `infrastructure/` directory:
- `main.tf` - Provider configuration
- `variables.tf` - Input variables
- `dynamodb.tf` - DynamoDB table and IAM
- `lambda.tf` - Lambda function
- `api-gateway.tf` - API Gateway configuration
- `outputs.tf` - Output values

To modify infrastructure:
1. Edit relevant `.tf` files
2. Run `make tofu-plan` to preview changes
3. Run `make tofu-apply` to apply changes

## Support

For issues or questions:
1. Check logs in CloudWatch
2. Review this documentation
3. Check AWS service health
4. Contact the development team