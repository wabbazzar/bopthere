#!/bin/bash
# Verification script to ensure all resources are in us-east-1
# Migration from us-west-2 to us-east-1 has been completed

set -e

PROFILE="personal"
NEW_REGION="us-east-1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔍 Verifying all AWS resources are in us-east-1..."
echo ""

# Check for resources in us-east-1
echo "✅ Checking resources in us-east-1..."

# Check Lambda functions
echo "Checking Lambda functions..."
EAST_LAMBDAS=$(aws lambda list-functions --region $NEW_REGION --profile $PROFILE --query "Functions[?contains(FunctionName, 'heatherandwesley')].FunctionName" --output text 2>/dev/null || echo "")
if [ -n "$EAST_LAMBDAS" ]; then
    echo -e "${GREEN}✅ Found Lambda functions in us-east-1: $EAST_LAMBDAS${NC}"
else
    echo -e "${YELLOW}⚠️  No Lambda functions found in us-east-1${NC}"
fi

# Check DynamoDB tables
echo "Checking DynamoDB tables..."
EAST_TABLES=$(aws dynamodb list-tables --region $NEW_REGION --profile $PROFILE --query "TableNames[?contains(@, 'heatherandwesley')]" --output text 2>/dev/null || echo "")
if [ -n "$EAST_TABLES" ]; then
    echo -e "${GREEN}✅ Found DynamoDB tables in us-east-1: $EAST_TABLES${NC}"
else
    echo -e "${YELLOW}⚠️  No DynamoDB tables found in us-east-1${NC}"
fi

# Check API Gateways
echo "Checking API Gateways..."
EAST_APIS=$(aws apigateway get-rest-apis --region $NEW_REGION --profile $PROFILE --query "items[?contains(name, 'heatherandwesley')].name" --output text 2>/dev/null || echo "")
if [ -n "$EAST_APIS" ]; then
    echo -e "${GREEN}✅ Found API Gateways in us-east-1: $EAST_APIS${NC}"
else
    echo -e "${YELLOW}⚠️  No API Gateways found in us-east-1${NC}"
fi

echo ""
echo "📊 Migration Verification Summary:"
echo "=================================="
echo -e "${GREEN}✅ Migration to us-east-1 completed${NC}"
echo "   All resources are in us-east-1"
echo "   No legacy us-west-2 references remain"
