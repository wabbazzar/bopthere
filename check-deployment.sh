#!/bin/bash
# Check deployment status of AWS resources

PROFILE="personal"
REGION="us-east-1"

echo "=== Checking AWS Deployment Status ==="
echo ""

# Check DynamoDB
echo "✓ DynamoDB Table:"
aws dynamodb describe-table --table-name heatherandwesley-users --profile $PROFILE --region $REGION 2>/dev/null | jq -r '.Table | "  Name: \(.TableName)\n  Status: \(.TableStatus)\n  ARN: \(.TableArn)"' || echo "  ❌ Not found"

echo ""

# Check Lambda
echo "✓ Lambda Function:"
aws lambda get-function --function-name heatherandwesley-rsvp-handler --profile $PROFILE --region $REGION 2>/dev/null | jq -r '.Configuration | "  Name: \(.FunctionName)\n  State: \(.State)\n  ARN: \(.FunctionArn)"' || echo "  ❌ Not found"

echo ""

# Check API Gateway
echo "✓ API Gateway:"
API_ID=$(aws apigateway get-rest-apis --profile $PROFILE --region $REGION --query "items[?name=='heatherandwesley-api'].id" --output text)
if [ -n "$API_ID" ]; then
    echo "  ID: $API_ID"
    echo "  Name: heatherandwesley-api"
    
    # Check if stage exists
    STAGE_INFO=$(aws apigateway get-stage --rest-api-id $API_ID --stage-name prod --profile $PROFILE --region $REGION 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "  Stage: prod ✓"
        echo "  Invoke URL: https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
    else
        echo "  Stage: prod ❌ Not found"
    fi
else
    echo "  ❌ Not found"
fi

echo ""
echo "=== API Gateway URL for .env file ==="
if [ -n "$API_ID" ]; then
    echo "VITE_API_GATEWAY_URL=https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
else
    echo "API Gateway not deployed yet"
fi