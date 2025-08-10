# AWS Region Configuration

**AWS Region**: `us-east-1` (N. Virginia)

## Important: All Resources MUST be in us-east-1

This project has been fully migrated to us-east-1. All AWS resources are deployed in this region.

### AWS CLI Commands
Always include the region flag:
```bash
--region us-east-1 --profile personal
```

### Examples:
```bash
aws dynamodb list-tables --region us-east-1 --profile personal
aws lambda list-functions --region us-east-1 --profile personal
aws apigateway get-rest-apis --region us-east-1 --profile personal
```

### Python/Boto3:
```python
session = boto3.Session(profile_name='personal', region_name='us-east-1')
```

### Shell Scripts:
```bash
REGION="us-east-1"
PROFILE="personal"
```

## Migration Completed
The migration from us-west-2 to us-east-1 was completed successfully. All resources are now in us-east-1.
