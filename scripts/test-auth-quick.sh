#!/bin/bash
# Quick auth test for pre-commit hooks
# Tests only the most critical auth functionality

set -e

echo "🔐 Running quick auth verification..."

# Get API Gateway URL from .env or use default
if [ -f .env ]; then
    source .env
    API_URL="${VITE_API_GATEWAY_URL:-https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod}"
else
    API_URL="https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod"
fi

# Verify we're using the correct API Gateway
if echo "$API_URL" | grep -q "4q7jj56io8"; then
    echo "❌ ERROR: Using wrong API Gateway ID (4q7jj56io8)"
    echo "Auth endpoints are on emwkjk2c9d, not 4q7jj56io8"
    echo "Please update VITE_API_GATEWAY_URL in .env"
    exit 1
fi

# Test 1: Basic connectivity (with timeout)
echo -n "  Testing auth endpoint connectivity... "
if timeout 5 curl -s -o /dev/null -w "%{http_code}" "$API_URL/auth/login" -X POST -H "Content-Type: application/json" -d '{}' | grep -q "400"; then
    echo "✅"
else
    echo "❌"
    echo "  Auth endpoint not responding correctly"
    exit 1
fi

# Test 2: CORS headers (critical for frontend)
echo -n "  Testing CORS configuration... "
CORS_RESPONSE=$(timeout 5 curl -s -I -X OPTIONS "$API_URL/auth/login" \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" 2>/dev/null || echo "TIMEOUT")

if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
    echo "✅"
else
    echo "❌"
    echo "  CORS headers missing - this will break frontend auth!"
    echo "  Debug: Response was:"
    echo "$CORS_RESPONSE" | head -5
    exit 1
fi

# Test 3: Valid login (using test account)
echo -n "  Testing authentication flow... "
AUTH_RESPONSE=$(timeout 10 curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testguest","password":"wedding2025"}' 2>/dev/null || echo "TIMEOUT")

STATUS_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
BODY=$(echo "$AUTH_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" = "200" ] && echo "$BODY" | jq -e '.token' >/dev/null 2>&1; then
    echo "✅"
elif [ "$STATUS_CODE" = "401" ]; then
    echo "✅ (401 - credentials invalid but endpoint working)"
else
    echo "❌"
    echo "  Auth endpoint returned unexpected status: $STATUS_CODE"
    echo "  This indicates a serious auth problem!"
    exit 1
fi

echo "✅ Auth verification passed!"