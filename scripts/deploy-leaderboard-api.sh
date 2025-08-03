#!/bin/bash
# Deploy API Gateway for leaderboard endpoints

# Set variables
API_NAME="heatherandwesley-api"
LAMBDA_NAME="heatherandwesley-leaderboard-handler"
PROFILE="personal"
REGION="us-east-1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Deploying API Gateway for leaderboard endpoints..."

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query Account --output text)

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}✗ Failed to get AWS account ID${NC}"
    exit 1
fi

# Check if API already exists
API_ID=$(aws apigateway get-rest-apis --profile $PROFILE --query "items[?name=='$API_NAME'].id" --output text 2>/dev/null)

if [ -z "$API_ID" ]; then
    echo "Creating new REST API..."
    API_ID=$(aws apigateway create-rest-api \
        --name "$API_NAME" \
        --description "Wedding App API including leaderboard endpoints" \
        --profile $PROFILE \
        --query 'id' \
        --output text)
    
    if [ -z "$API_ID" ]; then
        echo -e "${RED}✗ Failed to create API Gateway${NC}"
        exit 1
    fi
    echo "Created API Gateway with ID: $API_ID"
else
    echo "Using existing API Gateway with ID: $API_ID"
fi

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --profile $PROFILE \
    --query "items[?path=='/'].id" \
    --output text)

# Create /leaderboard resource if it doesn't exist
LEADERBOARD_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --profile $PROFILE \
    --query "items[?pathPart=='leaderboard'].id" \
    --output text)

if [ -z "$LEADERBOARD_ID" ]; then
    echo "Creating /leaderboard resource..."
    LEADERBOARD_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_ID \
        --path-part "leaderboard" \
        --profile $PROFILE \
        --query 'id' \
        --output text)
fi

# Create /{game} resource under /leaderboard
GAME_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --profile $PROFILE \
    --query "items[?pathPart=='{game}' && parentId=='$LEADERBOARD_ID'].id" \
    --output text)

if [ -z "$GAME_ID" ]; then
    echo "Creating /leaderboard/{game} resource..."
    GAME_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $LEADERBOARD_ID \
        --path-part "{game}" \
        --profile $PROFILE \
        --query 'id' \
        --output text)
fi

# Function to create or update a method
create_or_update_method() {
    local RESOURCE_ID=$1
    local HTTP_METHOD=$2
    local AUTH_REQUIRED=$3
    
    # Check if method exists
    aws apigateway get-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --profile $PROFILE &>/dev/null
    
    if [ $? -ne 0 ]; then
        echo "Creating $HTTP_METHOD method..."
        if [ "$AUTH_REQUIRED" = "true" ]; then
            aws apigateway put-method \
                --rest-api-id $API_ID \
                --resource-id $RESOURCE_ID \
                --http-method $HTTP_METHOD \
                --authorization-type "NONE" \
                --profile $PROFILE
        else
            aws apigateway put-method \
                --rest-api-id $API_ID \
                --resource-id $RESOURCE_ID \
                --http-method $HTTP_METHOD \
                --authorization-type "NONE" \
                --profile $PROFILE
        fi
    fi
    
    # Create Lambda integration
    echo "Setting up Lambda integration for $HTTP_METHOD..."
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$LAMBDA_NAME/invocations" \
        --profile $PROFILE
    
    # Set up method response
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --status-code 200 \
        --response-parameters "{\"method.response.header.Access-Control-Allow-Origin\":false,\"method.response.header.Access-Control-Allow-Headers\":false,\"method.response.header.Access-Control-Allow-Methods\":false}" \
        --profile $PROFILE
    
    # Set up integration response
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $HTTP_METHOD \
        --status-code 200 \
        --response-parameters "{\"method.response.header.Access-Control-Allow-Origin\":\"'*'\",\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Requested-With'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,POST,OPTIONS'\"}" \
        --profile $PROFILE
}

# Create GET method for /leaderboard/{game}
create_or_update_method $GAME_ID "GET" "false"

# Create POST method for /leaderboard/{game}
create_or_update_method $GAME_ID "POST" "true"

# Create OPTIONS method for CORS preflight
echo "Creating OPTIONS method for CORS..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $GAME_ID \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --profile $PROFILE 2>/dev/null

# Set up OPTIONS integration for CORS
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $GAME_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates "{\"application/json\":\"{\\\"statusCode\\\": 200}\"}" \
    --profile $PROFILE

# Set up OPTIONS method response
aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $GAME_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Origin\":false,\"method.response.header.Access-Control-Allow-Headers\":false,\"method.response.header.Access-Control-Allow-Methods\":false,\"method.response.header.Access-Control-Max-Age\":false}" \
    --profile $PROFILE

# Set up OPTIONS integration response
aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $GAME_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Origin\":\"'*'\",\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Requested-With'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,POST,OPTIONS'\",\"method.response.header.Access-Control-Max-Age\":\"'86400'\"}" \
    --profile $PROFILE

# Grant Lambda permission for API Gateway
echo "Granting API Gateway permission to invoke Lambda..."
for METHOD in GET POST OPTIONS; do
    aws lambda add-permission \
        --function-name $LAMBDA_NAME \
        --statement-id "apigateway-$METHOD-$(date +%s)" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*/leaderboard/*" \
        --profile $PROFILE 2>/dev/null || true
done

# Deploy API
echo "Deploying API to prod stage..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --stage-description "Production stage for wedding app API" \
    --profile $PROFILE

# Get the API endpoint
API_ENDPOINT="https://$API_ID.execute-api.$REGION.amazonaws.com/prod"

echo -e "${GREEN}✓ API Gateway deployed successfully!${NC}"
echo ""
echo "API Endpoints:"
echo "  GET  $API_ENDPOINT/leaderboard/{game}"
echo "  POST $API_ENDPOINT/leaderboard/{game}"
echo ""
echo "Example usage:"
echo "  curl $API_ENDPOINT/leaderboard/tetris"
echo ""
echo "Next steps:"
echo "1. Test the endpoints with: make test-leaderboard-api"
echo "2. Update frontend to use these endpoints"