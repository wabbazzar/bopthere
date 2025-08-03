# 🚨 CRITICAL AWS REGION CONFIGURATION 🚨

## ⚠️ MANDATORY: ALL AWS RESOURCES MUST BE IN US-WEST-2 (OREGON) ⚠️

### DO NOT USE ANY OTHER REGION!

**Project**: heatherandwesley
**AWS Region**: `us-west-2` (Oregon)
**Profile**: `personal`

### Why This Matters:
1. **All existing infrastructure is in us-west-2**:
   - DynamoDB tables (users, auth)
   - Lambda functions
   - API Gateway
   - S3 buckets
   
2. **Cross-region issues**:
   - Increased latency
   - Additional data transfer costs
   - Split infrastructure management
   - Potential data residency compliance issues

### For ALL AWS Commands:
```bash
# ALWAYS include these flags:
--region us-west-2 --profile personal

# Examples:
aws dynamodb list-tables --region us-west-2 --profile personal
aws lambda list-functions --region us-west-2 --profile personal
aws apigateway get-rest-apis --region us-west-2 --profile personal
```

### For Infrastructure Scripts:
```bash
# ALWAYS set these variables:
REGION="us-west-2"
PROFILE="personal"
```

### For Terraform/OpenTofu:
```hcl
provider "aws" {
  region  = "us-west-2"
  profile = "personal"
}
```

### For Python/Boto3:
```python
import boto3

# ALWAYS specify region:
session = boto3.Session(profile_name='personal', region_name='us-west-2')
dynamodb = session.resource('dynamodb')
lambda_client = session.client('lambda')
```

### Verification Commands:
```bash
# Check existing resources:
aws dynamodb list-tables --region us-west-2 --profile personal
aws lambda list-functions --region us-west-2 --profile personal
aws apigateway get-rest-apis --region us-west-2 --profile personal

# NEVER run these without --region us-west-2!
```

## 🛑 IF YOU ACCIDENTALLY CREATE RESOURCES IN THE WRONG REGION:

1. **STOP immediately**
2. **List what was created**
3. **Delete the resources from the wrong region**
4. **Recreate in us-west-2**

## 📝 Current Infrastructure Status:
- ✅ DynamoDB tables: us-west-2
- ✅ Auth Lambda: us-west-2
- ✅ API Gateway: us-west-2
- ✅ Leaderboard Lambda: us-west-2 (migrated from us-east-1)
- ✅ Leaderboard DynamoDB: us-west-2 (migrated from us-east-1)

## ⛔ DO NOT FORGET: us-west-2 ONLY!