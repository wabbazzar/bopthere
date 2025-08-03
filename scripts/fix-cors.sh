#!/bin/bash

# Fix CORS configuration for auth endpoints
API_ID="m1wocluixd"
AWS_PROFILE="personal"
AWS_REGION="us-east-1"

# Auth endpoint resource IDs
LOGIN_ID="fclu8x"
VERIFY_ID="1nrdip"
REGISTER_ID="l3abc4"

for RESOURCE_ID in $LOGIN_ID $VERIFY_ID $REGISTER_ID; do
    echo "Fixing CORS for resource $RESOURCE_ID..."
    
    # Delete existing integration response
    aws apigateway delete-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --profile $AWS_PROFILE \
        --region $AWS_REGION 2>/dev/null || true
    
    # Create new integration response with proper CORS headers
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'OPTIONS,POST'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --response-templates '{"application/json": ""}' \
        --profile $AWS_PROFILE \
        --region $AWS_REGION
done

# Deploy changes
echo "Deploying API changes..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Fixed CORS configuration" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION

echo "CORS configuration fixed!"