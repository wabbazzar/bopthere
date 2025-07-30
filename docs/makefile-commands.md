# Makefile Commands Documentation

This document provides detailed information about all available Makefile commands for managing the wedding app's AWS infrastructure.

## Overview

The Makefile provides a convenient interface for managing AWS resources using OpenTofu (infrastructure as code) and the AWS CLI. All commands use the `--profile personal` AWS profile.

## Command Categories

### Help and Information

#### `make help`
Displays all available commands with brief descriptions.

```bash
make help
```

### OpenTofu Infrastructure Operations

These commands manage infrastructure using OpenTofu configuration files.

#### `make tofu-init`
Initializes OpenTofu configuration. Run this before any other OpenTofu commands.

```bash
make tofu-init
```

#### `make tofu-plan`
Shows planned infrastructure changes without applying them. Use this to preview what will be created, modified, or destroyed.

```bash
make tofu-plan
```

#### `make tofu-apply`
Applies infrastructure changes. Creates or updates AWS resources based on OpenTofu configuration.

```bash
make tofu-apply
```

#### `make tofu-destroy`
Destroys all infrastructure managed by OpenTofu. Requires confirmation. **CAUTION**: This deletes all resources and data.

```bash
make tofu-destroy
# You will be prompted to confirm with 'y'
```

#### `make tofu-validate`
Validates OpenTofu configuration syntax without connecting to AWS.

```bash
make tofu-validate
```

#### `make tofu-fmt`
Formats OpenTofu configuration files to canonical style.

```bash
make tofu-fmt
```

### DynamoDB Operations

#### `make create-table`
Creates the DynamoDB table via OpenTofu. Equivalent to `make tofu-apply` if only table resources need creation.

```bash
make create-table
```

#### `make update-table`
Updates DynamoDB table configuration via OpenTofu.

```bash
make update-table
```

#### `make delete-table`
Deletes the DynamoDB table. Requires confirmation. **CAUTION**: This deletes all RSVP data.

```bash
make delete-table
```

#### `make describe-table`
Shows detailed information about the DynamoDB table including schema, indexes, and status.

```bash
make describe-table
```

Output includes:
- Table status
- Primary key schema
- Global secondary indexes
- Billing mode
- Encryption settings

#### `make list-tables`
Lists all DynamoDB tables in the AWS account/region.

```bash
make list-tables
```

### Lambda Operations

#### `make deploy-lambda`
Deploys the Lambda function via OpenTofu. Creates the function if it doesn't exist.

```bash
make deploy-lambda
```

#### `make update-lambda`
Updates Lambda function code after changes to `aws/lambda/rsvp-handler.py`.

```bash
make update-lambda
```

This command:
1. Zips the Lambda code
2. Uploads it to AWS
3. Updates the function
4. Cleans up the zip file

#### `make test-lambda`
Tests the Lambda function with sample RSVP data.

```bash
make test-lambda
```

Sends a test payload:
```json
{
  "httpMethod": "POST",
  "body": "{\"name\":\"Test Guest\",\"email\":\"test@example.com\",\"attendance\":\"yes\"}"
}
```

#### `make delete-lambda`
Deletes the Lambda function via OpenTofu.

```bash
make delete-lambda
```

### API Gateway Operations

#### `make deploy-api`
Deploys API Gateway configuration via OpenTofu.

```bash
make deploy-api
```

#### `make update-api`
Updates API Gateway settings via OpenTofu.

```bash
make update-api
```

#### `make test-api`
Tests API Gateway endpoints by making an HTTP request to the RSVP endpoint.

```bash
make test-api
```

Performs:
- Retrieves API URL from OpenTofu output
- Sends POST request to /rsvp endpoint
- Displays response

#### `make delete-api`
Deletes API Gateway via OpenTofu.

```bash
make delete-api
```

### Full Stack Operations

#### `make deploy-all`
Deploys all infrastructure components in the correct order.

```bash
make deploy-all
```

Executes:
1. `make tofu-init`
2. `make tofu-apply`

#### `make test-all`
Tests the complete integration chain.

```bash
make test-all
```

Executes:
1. `make describe-table` - Verify DynamoDB exists
2. `make test-lambda` - Test Lambda function
3. `make test-api` - Test API Gateway

#### `make cleanup-all`
Deletes ALL AWS resources. Requires typing "DELETE" to confirm.

```bash
make cleanup-all
# Type "DELETE" when prompted
```

**EXTREME CAUTION**: This command:
- Deletes the DynamoDB table (and all data)
- Removes Lambda function
- Deletes API Gateway
- Removes all IAM roles and policies
- Deletes CloudWatch log groups

## Usage Examples

### First Time Setup
```bash
# Initialize and deploy everything
make tofu-init
make deploy-all

# Verify deployment
make test-all
```

### Daily Development
```bash
# After modifying Lambda code
make update-lambda
make test-lambda

# Check table contents
make describe-table
```

### Infrastructure Changes
```bash
# After modifying .tf files
make tofu-validate  # Check syntax
make tofu-fmt       # Format code
make tofu-plan      # Preview changes
make tofu-apply     # Apply changes
```

### Debugging
```bash
# Test individual components
make test-lambda    # Test Lambda directly
make test-api       # Test via API Gateway
make describe-table # Check table status
```

### Cleanup
```bash
# Remove everything (be very careful!)
make cleanup-all
```

## Tips and Best Practices

1. **Always run `make tofu-plan` before `make tofu-apply`** to preview changes

2. **Use `make test-all` after deployments** to verify everything works

3. **Keep OpenTofu state files safe** - they track your infrastructure

4. **Set AWS_PROFILE environment variable** if not using default profile:
   ```bash
   export AWS_PROFILE=personal
   make deploy-all
   ```

5. **Check costs regularly** - DynamoDB and Lambda have free tiers but can incur charges

6. **Use `make tofu-fmt` before committing** to maintain consistent formatting

7. **Never commit AWS credentials** - use AWS profiles instead

## Troubleshooting

### "Command not found" errors
- Ensure AWS CLI is installed: `aws --version`
- Ensure OpenTofu is installed: `tofu --version`

### "Access Denied" errors
- Check AWS credentials: `aws sts get-caller-identity --profile personal`
- Verify IAM permissions for your AWS user

### "Table already exists" errors
- Run `make describe-table` to check existing table
- Use `make tofu-import` if needed (advanced)

### Lambda test failures
- Check Lambda logs in CloudWatch
- Verify environment variables are set
- Ensure DynamoDB table exists