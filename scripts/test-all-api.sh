#!/bin/bash

# Comprehensive API testing script with proper authentication

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED_TESTS=0
FAILED_TESTS=0

# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis \
    --profile personal \
    --region us-east-1 \
    --query "items[?name=='heatherandwesley-api'].id" \
    --output text 2>/dev/null | awk '{print $NF}')

if [ -z "$API_ID" ]; then
    echo -e "${RED}❌ API Gateway not found${NC}"
    exit 1
fi

API_URL="https://${API_ID}.execute-api.us-east-1.amazonaws.com/prod"
echo "🌐 Using API URL: $API_URL"

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local auth_header=$5
    
    echo ""
    echo "Testing: $description"
    echo "Method: $method"
    echo "Endpoint: $API_URL$endpoint"
    
    if [ "$method" = "POST" ]; then
        if [ -n "$auth_header" ]; then
            RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $auth_header" \
                -d "$data" 2>/dev/null)
        else
            RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null)
        fi
    else
        if [ -n "$auth_header" ]; then
            RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint" \
                -H "Authorization: Bearer $auth_header" 2>/dev/null)
        else
            RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint" 2>/dev/null)
        fi
    fi
    
    # Extract status code and body
    STATUS_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    echo "Response Status: $STATUS_CODE"
    echo "Response Body:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Check if test passed (2xx status codes)
    if [[ "$STATUS_CODE" =~ ^2[0-9][0-9]$ ]]; then
        echo -e "${GREEN}✅ Test PASSED${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Test FAILED${NC}"
        ((FAILED_TESTS++))
    fi
}

echo ""
echo "========================================"
echo "1. Authentication Tests"
echo "========================================"

# Create test user if not exists
echo "Ensuring test user exists..."
poetry run python scripts/seed-leaderboard-test-user.py > /dev/null 2>&1 || true

# Login to get token
echo ""
echo "Logging in test user..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "leaderboard_test_user",
        "password": "TestPassword123!"
    }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to get auth token${NC}"
    echo "Response: $LOGIN_RESPONSE"
    ((FAILED_TESTS++))
else
    echo -e "${GREEN}✅ Authentication successful${NC}"
    ((PASSED_TESTS++))
fi

# Test auth verify (using POST method as per Lambda implementation)
echo ""
echo "Testing: Verify authentication token"
echo "Method: POST"
echo "Endpoint: $API_URL/auth/verify"
VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/verify" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}' 2>/dev/null)

STATUS_CODE=$(echo "$VERIFY_RESPONSE" | tail -n1)
BODY=$(echo "$VERIFY_RESPONSE" | sed '$d')

echo "Response Status: $STATUS_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [[ "$STATUS_CODE" =~ ^2[0-9][0-9]$ ]]; then
    echo -e "${GREEN}✅ Test PASSED${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ Test FAILED${NC}"
    ((FAILED_TESTS++))
fi

echo ""
echo "========================================"
echo "2. RSVP Endpoint Tests"
echo "========================================"

test_endpoint "POST" "/rsvp" \
    '{"name":"Test Guest","email":"test@example.com","attendance":"yes","dietary_restrictions":"vegetarian","plus_one":true,"plus_one_name":"Plus One Guest","guest_count":2}' \
    "Submit RSVP with all fields"

test_endpoint "POST" "/rsvp" \
    '{"name":"Minimal Guest","email":"minimal@example.com","attendance":"yes"}' \
    "Submit RSVP with minimal fields"

echo ""
echo "========================================"
echo "3. Leaderboard Tests (Authenticated)"
echo "========================================"

test_endpoint "POST" "/leaderboard/tetris" \
    '{"score":1000,"character":"wesley"}' \
    "Submit Tetris score" \
    "$TOKEN"

test_endpoint "POST" "/leaderboard/typing" \
    '{"score":80,"character":"heather"}' \
    "Submit Typing score" \
    "$TOKEN"

test_endpoint "GET" "/leaderboard/tetris" "" "Get Tetris leaderboard"
test_endpoint "GET" "/leaderboard/typing" "" "Get Typing leaderboard"

echo ""
echo "========================================"
echo "4. Lambda Function Direct Tests"
echo "========================================"

echo "Testing RSVP Lambda directly..."
# Create proper Lambda payload
LAMBDA_PAYLOAD='{"httpMethod":"POST","body":"{\"name\":\"Lambda Test\",\"email\":\"lambda@test.com\",\"attendance\":\"yes\"}"}'
echo "$LAMBDA_PAYLOAD" > lambda-payload.json

LAMBDA_RESPONSE=$(aws lambda invoke \
    --function-name heatherandwesley-rsvp-handler \
    --cli-binary-format raw-in-base64-out \
    --payload file://lambda-payload.json \
    --profile personal \
    --region us-east-1 \
    --output json \
    response.json 2>&1)

if [ $? -eq 0 ]; then
    echo "Lambda response:"
    cat response.json | jq '.'
    rm -f response.json lambda-payload.json
    echo -e "${GREEN}✅ RSVP Lambda test PASSED${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ RSVP Lambda test FAILED${NC}"
    echo "Error: $LAMBDA_RESPONSE"
    rm -f lambda-payload.json
    ((FAILED_TESTS++))
fi

echo ""
echo "========================================"
echo "5. DynamoDB Table Verification"
echo "========================================"

for table in "heatherandwesley-users" "heatherandwesley-auth-users" "heatherandwesley-leaderboard"; do
    echo "Checking table: $table"
    TABLE_INFO=$(aws dynamodb describe-table \
        --table-name "$table" \
        --profile personal \
        --region us-east-1 \
        --query 'Table.{Status:TableStatus,ItemCount:ItemCount}' \
        --output json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        STATUS=$(echo "$TABLE_INFO" | jq -r '.Status')
        COUNT=$(echo "$TABLE_INFO" | jq -r '.ItemCount')
        echo -e "${GREEN}✅ Table exists with $COUNT items (approximate)${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ Table not found${NC}"
        ((FAILED_TESTS++))
    fi
done

echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo -e "${GREEN}✅ $PASSED_TESTS tests PASSED${NC}"

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}❌ $FAILED_TESTS tests FAILED${NC}"
    echo "Please check the errors above"
    exit 1
else
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
fi