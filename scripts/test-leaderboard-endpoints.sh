#!/bin/bash
# Test leaderboard API endpoints

# Set variables
API_NAME="heatherandwesley-api"
PROFILE="personal"
REGION="us-east-1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "Testing leaderboard API endpoints..."

# Get API ID
API_ID=$(aws apigateway get-rest-apis --profile $PROFILE --query "items[?name=='$API_NAME'].id" --output text 2>/dev/null)

if [ -z "$API_ID" ]; then
    echo -e "${RED}✗ API Gateway not found. Run 'make deploy-leaderboard-api' first.${NC}"
    exit 1
fi

API_ENDPOINT="https://$API_ID.execute-api.$REGION.amazonaws.com/prod"

echo -e "${BLUE}API Endpoint: $API_ENDPOINT${NC}"
echo ""

# Test 1: GET leaderboard (should work without auth)
echo -e "${YELLOW}Test 1: GET /leaderboard/tetris (no auth required)${NC}"
curl -X GET "$API_ENDPOINT/leaderboard/tetris" \
    -H "Content-Type: application/json" \
    -w "\nHTTP Status: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || echo "Response parsing failed"
echo ""

# Test 2: OPTIONS preflight request
echo -e "${YELLOW}Test 2: OPTIONS /leaderboard/tetris (CORS preflight)${NC}"
curl -X OPTIONS "$API_ENDPOINT/leaderboard/tetris" \
    -H "Origin: https://heatherandwesley.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type, Authorization" \
    -w "\nHTTP Status: %{http_code}\n" \
    -i -s | grep -E "(HTTP|Access-Control)"
echo ""

# Test 3: POST without auth (should fail with 401)
echo -e "${YELLOW}Test 3: POST /leaderboard/tetris without auth (should fail)${NC}"
curl -X POST "$API_ENDPOINT/leaderboard/tetris" \
    -H "Content-Type: application/json" \
    -d '{"score": 1000, "character": "wesley"}' \
    -w "\nHTTP Status: %{http_code}\n" \
    -s | jq '.' 2>/dev/null || echo "Response parsing failed"
echo ""

# Test 4: POST with auth (create a test token)
echo -e "${YELLOW}Test 4: POST /leaderboard/tetris with JWT token${NC}"
# Generate a test JWT token using Python
JWT_TOKEN=$(python3 -c "
import jwt
from datetime import datetime, timedelta

payload = {
    'username': 'api-test-user',
    'role': 'guest',
    'exp': datetime.utcnow() + timedelta(hours=1),
    'iat': datetime.utcnow()
}
token = jwt.encode(payload, 'development-secret-key-change-in-production', algorithm='HS256')
print(token)
" 2>/dev/null)

if [ -n "$JWT_TOKEN" ]; then
    curl -X POST "$API_ENDPOINT/leaderboard/tetris" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -d '{"score": 12345, "character": "heather"}' \
        -w "\nHTTP Status: %{http_code}\n" \
        -s | jq '.' 2>/dev/null || echo "Response parsing failed"
else
    echo -e "${RED}Failed to generate test JWT token. Install PyJWT: pip install pyjwt${NC}"
fi
echo ""

# Test 5: Test CORS with actual browser origin
echo -e "${YELLOW}Test 5: Test CORS headers with production origin${NC}"
curl -X GET "$API_ENDPOINT/leaderboard/tetris" \
    -H "Origin: https://heatherandwesley.com" \
    -w "\nHTTP Status: %{http_code}\n" \
    -i -s | grep -E "(HTTP|Access-Control-Allow-Origin)"
echo ""

# Test 6: Test CORS with localhost origin
echo -e "${YELLOW}Test 6: Test CORS headers with localhost origin${NC}"
curl -X GET "$API_ENDPOINT/leaderboard/tetris" \
    -H "Origin: http://localhost:5173" \
    -w "\nHTTP Status: %{http_code}\n" \
    -i -s | grep -E "(HTTP|Access-Control-Allow-Origin)"
echo ""

echo -e "${GREEN}✓ API endpoint tests complete!${NC}"
echo ""
echo "Summary:"
echo "  - API Gateway URL: $API_ENDPOINT"
echo "  - GET endpoint: $API_ENDPOINT/leaderboard/{game}"
echo "  - POST endpoint: $API_ENDPOINT/leaderboard/{game} (requires JWT auth)"