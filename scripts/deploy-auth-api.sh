#!/bin/bash

# Deploy Authentication API Gateway Resources
# This script adds authentication endpoints to the existing API Gateway

set -e

# Configuration
AWS_PROFILE="personal"
AWS_REGION="us-west-2"
API_ID="m1wocluixd"
AUTH_LAMBDA_NAME="heatherandwesley-auth-handler"

echo "🚀 Adding authentication endpoints to existing API Gateway..."

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

# Get Lambda ARN
LAMBDA_ARN="arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$AUTH_LAMBDA_NAME"
echo "Lambda ARN: $LAMBDA_ARN"

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?path=='/'].id" --output text)
echo "Root Resource ID: $ROOT_RESOURCE_ID"

# 1. Create /auth resource
echo "📁 Creating /auth resource..."
AUTH_RESOURCE_RESPONSE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "auth" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>&1) || {
    if echo "$AUTH_RESOURCE_RESPONSE" | grep -q "ConflictException"; then
        echo "⚠️  /auth resource already exists, getting existing resource..."
        AUTH_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?pathPart=='auth'].id" --output text)
    else
        echo "❌ Failed to create /auth resource: $AUTH_RESOURCE_RESPONSE"
        exit 1
    fi
}

if [ -z "$AUTH_RESOURCE_ID" ]; then
    AUTH_RESOURCE_ID=$(echo "$AUTH_RESOURCE_RESPONSE" | jq -r '.id')
fi

echo "Auth Resource ID: $AUTH_RESOURCE_ID"

# 2. Create /auth/login resource
echo "📁 Creating /auth/login resource..."
LOGIN_RESOURCE_RESPONSE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $AUTH_RESOURCE_ID \
    --path-part "login" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>&1) || {
    if echo "$LOGIN_RESOURCE_RESPONSE" | grep -q "ConflictException"; then
        echo "⚠️  /auth/login resource already exists, getting existing resource..."
        LOGIN_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?pathPart=='login'].id" --output text)
    else
        echo "❌ Failed to create /auth/login resource: $LOGIN_RESOURCE_RESPONSE"
        exit 1
    fi
}

if [ -z "$LOGIN_RESOURCE_ID" ]; then
    LOGIN_RESOURCE_ID=$(echo "$LOGIN_RESOURCE_RESPONSE" | jq -r '.id')
fi

echo "Login Resource ID: $LOGIN_RESOURCE_ID"

# 3. Create /auth/verify resource
echo "📁 Creating /auth/verify resource..."
VERIFY_RESOURCE_RESPONSE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $AUTH_RESOURCE_ID \
    --path-part "verify" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>&1) || {
    if echo "$VERIFY_RESOURCE_RESPONSE" | grep -q "ConflictException"; then
        echo "⚠️  /auth/verify resource already exists, getting existing resource..."
        VERIFY_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?pathPart=='verify'].id" --output text)
    else
        echo "❌ Failed to create /auth/verify resource: $VERIFY_RESOURCE_RESPONSE"
        exit 1
    fi
}

if [ -z "$VERIFY_RESOURCE_ID" ]; then
    VERIFY_RESOURCE_ID=$(echo "$VERIFY_RESOURCE_RESPONSE" | jq -r '.id')
fi

echo "Verify Resource ID: $VERIFY_RESOURCE_ID"

# 4. Create /auth/register resource
echo "📁 Creating /auth/register resource..."
REGISTER_RESOURCE_RESPONSE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $AUTH_RESOURCE_ID \
    --path-part "register" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>&1) || {
    if echo "$REGISTER_RESOURCE_RESPONSE" | grep -q "ConflictException"; then
        echo "⚠️  /auth/register resource already exists, getting existing resource..."
        REGISTER_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?pathPart=='register'].id" --output text)
    else
        echo "❌ Failed to create /auth/register resource: $REGISTER_RESOURCE_RESPONSE"
        exit 1
    fi
}

if [ -z "$REGISTER_RESOURCE_ID" ]; then
    REGISTER_RESOURCE_ID=$(echo "$REGISTER_RESOURCE_RESPONSE" | jq -r '.id')
fi

echo "Register Resource ID: $REGISTER_RESOURCE_ID"

# Function to create method and integration
create_auth_endpoint() {
    local RESOURCE_ID=$1
    local ENDPOINT_NAME=$2
    
    echo "🔧 Setting up $ENDPOINT_NAME endpoint..."
    
    # Create OPTIONS method for CORS
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --profile $AWS_PROFILE \
        --region $AWS_REGION || echo "OPTIONS method may already exist"
    
    # Create OPTIONS integration (mock)
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --integration-http-method OPTIONS \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --profile $AWS_PROFILE \
        --region $AWS_REGION || echo "OPTIONS integration may already exist"
    
    # Create OPTIONS method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true,method.response.header.Access-Control-Allow-Origin=true \
        --profile $AWS_PROFILE \
        --region $AWS_REGION || echo "OPTIONS method response may already exist"
    
    # Create OPTIONS integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'OPTIONS,POST'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
        --profile $AWS_PROFILE \
        --region $AWS_REGION || echo "OPTIONS integration response may already exist"
    
    # Create POST method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method POST \
        --authorization-type NONE \
        --profile $AWS_PROFILE \
        --region $AWS_REGION || echo "POST method may already exist"
    
    # Create POST integration (Lambda proxy)
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method POST \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION || echo "POST integration may already exist"
    
    echo "✅ $ENDPOINT_NAME endpoint configured"
}

# Create all auth endpoints
create_auth_endpoint $LOGIN_RESOURCE_ID "login"
create_auth_endpoint $VERIFY_RESOURCE_ID "verify"
create_auth_endpoint $REGISTER_RESOURCE_ID "register"

# 5. Grant API Gateway permission to invoke Lambda
echo "🔐 Granting API Gateway permission to invoke Lambda..."
aws lambda add-permission \
    --function-name $AUTH_LAMBDA_NAME \
    --statement-id apigateway-invoke-auth-$RANDOM \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$AWS_REGION:$ACCOUNT_ID:$API_ID/*/*" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION || echo "Permission may already exist"

# 6. Deploy the API
echo "🚀 Deploying API changes..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Added authentication endpoints" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION

# 7. Show the endpoints
API_URL="https://$API_ID.execute-api.$AWS_REGION.amazonaws.com/prod"
echo ""
echo "🎉 Authentication API Gateway setup complete!"
echo ""
echo "Available endpoints:"
echo "  POST $API_URL/auth/login"
echo "  POST $API_URL/auth/verify"
echo "  POST $API_URL/auth/register"
echo ""
echo "Test with:"
echo "curl -X POST $API_URL/auth/login \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"username\":\"testguest\",\"password\":\"wedding2025\"}'"