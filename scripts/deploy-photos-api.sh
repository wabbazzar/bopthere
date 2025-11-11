#!/bin/bash

# Deploy Photos API Gateway endpoints
# Creates /photos/list endpoint and integrates with photos-list-handler Lambda

set -e

AWS_PROFILE="personal"
AWS_REGION="us-east-1"
API_ID="emwkjk2c9d"  # Main heatherandwesley-api
LAMBDA_NAME="heatherandwesley-photos-list-handler"

echo "🚀 Deploying Photos API Gateway endpoints..."
echo "================================================"
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo "✓ AWS Account ID: $ACCOUNT_ID"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?path=='/'].id" --output text)
echo "✓ Root resource ID: $ROOT_ID"

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name $LAMBDA_NAME --profile $AWS_PROFILE --region $AWS_REGION --query 'Configuration.FunctionArn' --output text)
echo "✓ Lambda ARN: $LAMBDA_ARN"

echo ""
echo "Step 1: Creating /photos resource..."
echo "======================================="

# Check if /photos resource already exists
PHOTOS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?path=='/photos'].id" --output text)

if [ -z "$PHOTOS_ID" ]; then
    PHOTOS_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_ID \
        --path-part "photos" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'id' \
        --output text)
    echo "✓ Created /photos resource: $PHOTOS_ID"
else
    echo "✓ /photos resource already exists: $PHOTOS_ID"
fi

echo ""
echo "Step 2: Creating /photos/list resource..."
echo "=========================================="

# Check if /photos/list resource already exists
LIST_ID=$(aws apigateway get-resources --rest-api-id $API_ID --profile $AWS_PROFILE --region $AWS_REGION --query "items[?path=='/photos/list'].id" --output text)

if [ -z "$LIST_ID" ]; then
    LIST_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $PHOTOS_ID \
        --path-part "list" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'id' \
        --output text)
    echo "✓ Created /photos/list resource: $LIST_ID"
else
    echo "✓ /photos/list resource already exists: $LIST_ID"
fi

echo ""
echo "Step 3: Creating GET method..."
echo "==============================="

# Create GET method
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $LIST_ID \
    --http-method GET \
    --authorization-type NONE \
    --profile $AWS_PROFILE \
    --region $AWS_REGION \
    --no-api-key-required 2>/dev/null || echo "✓ GET method may already exist"

# Set up Lambda integration for GET
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $LIST_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "✓ GET integration may already exist"

echo "✓ GET method configured"

echo ""
echo "Step 4: Creating OPTIONS method for CORS..."
echo "============================================="

# Create OPTIONS method
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $LIST_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --profile $AWS_PROFILE \
    --region $AWS_REGION \
    --no-api-key-required 2>/dev/null || echo "✓ OPTIONS method may already exist"

# Set up MOCK integration for OPTIONS
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $LIST_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "✓ OPTIONS integration may already exist"

# Set up OPTIONS method response
aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $LIST_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-models '{"application/json":"Empty"}' \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "✓ OPTIONS method response may already exist"

# Set up OPTIONS integration response
aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $LIST_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization'\''","method.response.header.Access-Control-Allow-Methods":"'\''GET,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "✓ OPTIONS integration response may already exist"

echo "✓ OPTIONS method configured for CORS"

echo ""
echo "Step 5: Granting API Gateway permission to invoke Lambda..."
echo "============================================================="

# Add Lambda permission for API Gateway
aws lambda add-permission \
    --function-name $LAMBDA_NAME \
    --statement-id apigateway-photos-list-get \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$AWS_REGION:$ACCOUNT_ID:$API_ID/*/GET/photos/list" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "✓ Lambda permission may already exist"

echo "✓ Lambda permission granted"

echo ""
echo "Step 6: Deploying API to 'prod' stage..."
echo "=========================================="

aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --description "Deploy photos list endpoint" \
    --profile $AWS_PROFILE \
    --region $AWS_REGION

echo "✓ API deployed to prod stage"

echo ""
echo "🎉 Photos API Gateway deployment complete!"
echo "==========================================="
echo ""
echo "📋 Endpoint Information:"
echo "  API URL: https://$API_ID.execute-api.$AWS_REGION.amazonaws.com/prod"
echo "  GET /photos/list - List all photos from S3 bucket"
echo ""
echo "📝 Next Steps:"
echo "  1. Test the endpoint: make test-photos-list-api"
echo "  2. Update frontend to use: \$VITE_API_BASE/photos/list"
echo ""
