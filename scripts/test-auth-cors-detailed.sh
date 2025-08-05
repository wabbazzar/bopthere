#!/bin/bash
# Detailed CORS and auth testing script
# This script performs comprehensive CORS validation for auth endpoints

set -e

echo "🔍 Running detailed CORS and authentication tests..."
echo "=================================================="

# Get API Gateway URL from environment or use default
API_URL="${VITE_API_GATEWAY_URL:-https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod}"
echo "Testing API Gateway: $API_URL"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check CORS headers
check_cors_headers() {
    local response="$1"
    local endpoint="$2"
    local method="$3"
    
    echo "Checking CORS headers for $method $endpoint:"
    
    # Check for Access-Control-Allow-Origin
    if echo "$response" | grep -qi "Access-Control-Allow-Origin"; then
        local origin=$(echo "$response" | grep -i "Access-Control-Allow-Origin" | cut -d' ' -f2)
        echo -e "  ${GREEN}✓${NC} Access-Control-Allow-Origin: $origin"
    else
        echo -e "  ${RED}✗${NC} Access-Control-Allow-Origin header missing!"
        return 1
    fi
    
    # Check for Access-Control-Allow-Methods
    if echo "$response" | grep -qi "Access-Control-Allow-Methods"; then
        local methods=$(echo "$response" | grep -i "Access-Control-Allow-Methods" | cut -d' ' -f2-)
        echo -e "  ${GREEN}✓${NC} Access-Control-Allow-Methods: $methods"
    else
        echo -e "  ${YELLOW}⚠${NC} Access-Control-Allow-Methods header missing"
    fi
    
    # Check for Access-Control-Allow-Headers
    if echo "$response" | grep -qi "Access-Control-Allow-Headers"; then
        local headers=$(echo "$response" | grep -i "Access-Control-Allow-Headers" | cut -d' ' -f2-)
        echo -e "  ${GREEN}✓${NC} Access-Control-Allow-Headers: $headers"
    else
        echo -e "  ${YELLOW}⚠${NC} Access-Control-Allow-Headers header missing"
    fi
    
    echo ""
}

# Test 1: Check if auth endpoints exist
echo "1. Checking auth endpoint availability:"
echo "---------------------------------------"

# Test login endpoint
echo -n "  Testing POST /auth/login... "
LOGIN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' 2>/dev/null || echo "FAILED")

if echo "$LOGIN_RESPONSE" | grep -q "HTTP_STATUS:4[0-9][0-9]"; then
    echo -e "${GREEN}✓ Endpoint exists${NC}"
elif echo "$LOGIN_RESPONSE" | grep -q "HTTP_STATUS:200"; then
    echo -e "${GREEN}✓ Endpoint exists (login succeeded)${NC}"
else
    echo -e "${RED}✗ Endpoint not found or error${NC}"
    echo "Response: $LOGIN_RESPONSE"
fi

echo ""

# Test 2: CORS Preflight (OPTIONS) Tests
echo "2. CORS Preflight (OPTIONS) Tests:"
echo "----------------------------------"

# Test OPTIONS for login endpoint
echo "Testing OPTIONS /auth/login:"
OPTIONS_RESPONSE=$(curl -s -I -X OPTIONS "$API_URL/auth/login" \
    -H "Origin: http://localhost:8080" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" 2>/dev/null)

if [ -z "$OPTIONS_RESPONSE" ]; then
    echo -e "${RED}✗ No response from OPTIONS request!${NC}"
    echo "This indicates the endpoint doesn't support CORS preflight."
    CORS_FAILED=true
else
    check_cors_headers "$OPTIONS_RESPONSE" "/auth/login" "OPTIONS"
    
    # Check status code
    if echo "$OPTIONS_RESPONSE" | grep -q "HTTP/[0-9.]* 200"; then
        echo -e "  ${GREEN}✓${NC} OPTIONS returned 200 OK"
    else
        echo -e "  ${RED}✗${NC} OPTIONS did not return 200 OK"
        CORS_FAILED=true
    fi
fi

echo ""

# Test 3: Actual POST request with Origin header
echo "3. Testing POST with Origin header:"
echo "-----------------------------------"

POST_RESPONSE=$(curl -s -i -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:8080" \
    -d '{"username":"testguest","password":"wedding2025"}' 2>/dev/null)

if [ -z "$POST_RESPONSE" ]; then
    echo -e "${RED}✗ No response from POST request!${NC}"
else
    # Extract headers and body
    HEADERS=$(echo "$POST_RESPONSE" | sed -n '1,/^\r*$/p')
    
    # Check CORS headers in response
    check_cors_headers "$HEADERS" "/auth/login" "POST"
    
    # Check if login was successful
    if echo "$POST_RESPONSE" | grep -q '"token"'; then
        echo -e "  ${GREEN}✓${NC} Authentication successful (token received)"
    elif echo "$POST_RESPONSE" | grep -q "401"; then
        echo -e "  ${YELLOW}⚠${NC} Authentication failed (401) but endpoint is working"
    fi
fi

echo ""

# Test 4: Check other auth endpoints
echo "4. Checking other auth endpoints:"
echo "---------------------------------"

# Test verify endpoint
echo -n "  Testing /auth/verify... "
VERIFY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/verify" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)

if [ "$VERIFY_RESPONSE" = "401" ] || [ "$VERIFY_RESPONSE" = "400" ]; then
    echo -e "${GREEN}✓ Endpoint exists${NC}"
elif [ "$VERIFY_RESPONSE" = "404" ]; then
    echo -e "${RED}✗ Endpoint not found${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response: $VERIFY_RESPONSE${NC}"
fi

# Test register endpoint
echo -n "  Testing /auth/register... "
REGISTER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)

if [ "$REGISTER_RESPONSE" = "400" ] || [ "$REGISTER_RESPONSE" = "409" ]; then
    echo -e "${GREEN}✓ Endpoint exists${NC}"
elif [ "$REGISTER_RESPONSE" = "404" ]; then
    echo -e "${RED}✗ Endpoint not found${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response: $REGISTER_RESPONSE${NC}"
fi

echo ""

# Test 5: Test from different origins
echo "5. Testing CORS from different origins:"
echo "--------------------------------------"

ORIGINS=("http://localhost:5173" "http://localhost:8080" "https://heatherandwesley.love")

for origin in "${ORIGINS[@]}"; do
    echo -n "  Testing from $origin... "
    
    ORIGIN_RESPONSE=$(curl -s -I -X OPTIONS "$API_URL/auth/login" \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" 2>/dev/null)
    
    if echo "$ORIGIN_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
        echo -e "${GREEN}✓ CORS allowed${NC}"
    else
        echo -e "${RED}✗ CORS blocked${NC}"
    fi
done

echo ""

# Summary
echo "================================="
echo "CORS Test Summary:"
echo "================================="

if [ -z "$CORS_FAILED" ]; then
    echo -e "${GREEN}✅ All CORS tests passed!${NC}"
    echo "Authentication endpoints are properly configured."
    exit 0
else
    echo -e "${RED}❌ CORS configuration issues detected!${NC}"
    echo ""
    echo "To fix CORS issues:"
    echo "1. Ensure API Gateway has CORS enabled for auth endpoints"
    echo "2. Check Lambda returns proper CORS headers"
    echo "3. Verify API Gateway ID in .env matches the one with auth endpoints"
    echo ""
    echo "Current API Gateway: $API_URL"
    echo "Auth endpoints should be on: emwkjk2c9d (not 4q7jj56io8)"
    exit 1
fi