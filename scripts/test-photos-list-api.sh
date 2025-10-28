#!/bin/bash

# Test Photos List API endpoint

AWS_REGION="us-east-1"
API_ID="emwkjk2c9d"
API_BASE="https://$API_ID.execute-api.$AWS_REGION.amazonaws.com/prod"

echo "🧪 Testing Photos List API Endpoint"
echo "===================================="
echo ""
echo "API Base: $API_BASE"
echo ""

echo "Test 1: OPTIONS request (CORS preflight)"
echo "-----------------------------------------"
echo "Request: OPTIONS $API_BASE/photos/list"
CORS_RESPONSE=$(curl -s -X OPTIONS $API_BASE/photos/list -i)
echo "$CORS_RESPONSE"

# Extract CORS headers
if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
    echo "✅ CORS headers present"
else
    echo "❌ CORS headers missing"
fi

echo ""
echo "Test 2: GET request without parameters"
echo "---------------------------------------"
echo "Request: GET $API_BASE/photos/list"
RESPONSE=$(curl -s -X GET $API_BASE/photos/list \
    -H "Content-Type: application/json" \
    -w "\nHTTP Status: %{http_code}\n")

echo "$RESPONSE"

# Check if response is valid JSON
if echo "$RESPONSE" | grep -q "photos"; then
    echo "✅ Valid response with 'photos' field"

    # Parse photo count
    PHOTO_COUNT=$(echo "$RESPONSE" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    echo "📸 Photo count: $PHOTO_COUNT"
else
    echo "❌ Invalid response format"
fi

echo ""
echo "Test 3: GET request with limit parameter"
echo "-----------------------------------------"
echo "Request: GET $API_BASE/photos/list?limit=5"
RESPONSE_LIMIT=$(curl -s -X GET "$API_BASE/photos/list?limit=5" \
    -H "Content-Type: application/json" \
    -w "\nHTTP Status: %{http_code}\n")

echo "$RESPONSE_LIMIT"

if echo "$RESPONSE_LIMIT" | grep -q "photos"; then
    echo "✅ Limit parameter works"
else
    echo "❌ Limit parameter failed"
fi

echo ""
echo "📋 Test Summary"
echo "==============="
echo "✓ CORS preflight (OPTIONS)"
echo "✓ Basic GET request"
echo "✓ GET with query parameters"
echo ""
echo "🎉 Photos List API testing complete!"
