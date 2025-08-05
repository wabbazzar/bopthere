#!/bin/bash

# Test leaderboard endpoints with authentication

# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis \
    --profile personal \
    --region us-east-1 \
    --query "items[?name=='heatherandwesley-api'].id" \
    --output text 2>/dev/null | awk '{print $NF}')

if [ -z "$API_ID" ]; then
    echo "❌ API Gateway not found"
    exit 1
fi

API_URL="https://${API_ID}.execute-api.us-east-1.amazonaws.com/prod"
echo "🌐 Using API URL: $API_URL"

# Step 1: Login to get JWT token
echo ""
echo "🔐 Logging in test user..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "leaderboard_test_user",
        "password": "TestPassword123!"
    }')

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Failed to get auth token"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Authentication successful"

# Step 2: Test leaderboard endpoints with auth
echo ""
echo "🎮 Testing leaderboard endpoints..."

# Submit Tetris score
echo ""
echo "Submitting Tetris score..."
TETRIS_RESPONSE=$(curl -s -X POST "$API_URL/leaderboard/tetris" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "score": 5000,
        "character": "wesley"
    }')

TETRIS_STATUS=$(echo "$TETRIS_RESPONSE" | jq -r '.statusCode // 200')
if [ "$TETRIS_STATUS" = "200" ] || [ "$TETRIS_STATUS" = "201" ]; then
    echo "✅ Tetris score submitted successfully"
else
    echo "❌ Failed to submit Tetris score"
    echo "Response: $TETRIS_RESPONSE"
fi

# Submit Typing score
echo ""
echo "Submitting Typing score..."
TYPING_RESPONSE=$(curl -s -X POST "$API_URL/leaderboard/typing" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "score": 85,
        "character": "heather"
    }')

TYPING_STATUS=$(echo "$TYPING_RESPONSE" | jq -r '.statusCode // 200')
if [ "$TYPING_STATUS" = "200" ] || [ "$TYPING_STATUS" = "201" ]; then
    echo "✅ Typing score submitted successfully"
else
    echo "❌ Failed to submit Typing score"
    echo "Response: $TYPING_RESPONSE"
fi

# Get leaderboards
echo ""
echo "📊 Retrieving leaderboards..."

# Get Tetris leaderboard
echo ""
echo "Tetris leaderboard:"
curl -s -X GET "$API_URL/leaderboard/tetris" | jq '.'

# Get Typing leaderboard
echo ""
echo "Typing leaderboard:"
curl -s -X GET "$API_URL/leaderboard/typing" | jq '.'

echo ""
echo "✅ Leaderboard auth test complete!"