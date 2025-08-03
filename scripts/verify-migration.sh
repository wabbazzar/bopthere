#!/bin/bash
# Migration verification script for wedding app
# Verifies all resources are in us-east-1 and none remain in us-west-2

set -e

AWS_PROFILE="personal"
NEW_REGION="us-east-1"
OLD_REGION="us-west-2"

echo "🔍 Verifying AWS migration from us-west-2 to us-east-1..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Counters
errors=0
warnings=0

echo "📋 Checking resources in target region (us-east-1)..."

# Check DynamoDB tables in us-east-1
echo "Checking DynamoDB tables in us-east-1..."
EAST_TABLES=$(aws dynamodb list-tables --profile $AWS_PROFILE --region $NEW_REGION --query 'TableNames[?starts_with(@, `heatherandwesley`)]' --output text 2>/dev/null || echo "")
if [ -n "$EAST_TABLES" ]; then
    echo -e "${GREEN}✅ Found DynamoDB tables in us-east-1: $EAST_TABLES${NC}"
else
    echo -e "${RED}❌ No DynamoDB tables found in us-east-1${NC}"
    ((errors++))
fi

# Check Lambda functions in us-east-1
echo "Checking Lambda functions in us-east-1..."
EAST_LAMBDAS=$(aws lambda list-functions --profile $AWS_PROFILE --region $NEW_REGION --query 'Functions[?starts_with(FunctionName, `heatherandwesley`)].FunctionName' --output text 2>/dev/null || echo "")
if [ -n "$EAST_LAMBDAS" ]; then
    echo -e "${GREEN}✅ Found Lambda functions in us-east-1: $EAST_LAMBDAS${NC}"
else
    echo -e "${RED}❌ No Lambda functions found in us-east-1${NC}"
    ((errors++))
fi

# Check API Gateway in us-east-1
echo "Checking API Gateway in us-east-1..."
EAST_APIS=$(aws apigateway get-rest-apis --profile $AWS_PROFILE --region $NEW_REGION --query 'items[?starts_with(name, `heatherandwesley`)].name' --output text 2>/dev/null || echo "")
if [ -n "$EAST_APIS" ]; then
    echo -e "${GREEN}✅ Found API Gateway in us-east-1: $EAST_APIS${NC}"
else
    echo -e "${RED}❌ No API Gateway found in us-east-1${NC}"
    ((errors++))
fi

echo ""
echo "🧹 Checking for leftover resources in old region (us-west-2)..."

# Check for Lambda functions in us-west-2
echo "Checking Lambda functions in us-west-2..."
WEST_LAMBDAS=$(aws lambda list-functions --profile $AWS_PROFILE --region $OLD_REGION --query 'Functions[?starts_with(FunctionName, `heatherandwesley`)].FunctionName' --output text 2>/dev/null || echo "")
if [ -n "$WEST_LAMBDAS" ]; then
    echo -e "${YELLOW}⚠️  Found Lambda functions in us-west-2: $WEST_LAMBDAS${NC}"
    echo "   These should be deleted after confirming us-east-1 is working"
    ((warnings++))
else
    echo -e "${GREEN}✅ No Lambda functions found in us-west-2${NC}"
fi

# Check for DynamoDB tables in us-west-2
echo "Checking DynamoDB tables in us-west-2..."
WEST_TABLES=$(aws dynamodb list-tables --profile $AWS_PROFILE --region $OLD_REGION --query 'TableNames[?starts_with(@, `heatherandwesley`)]' --output text 2>/dev/null || echo "")
if [ -n "$WEST_TABLES" ]; then
    echo -e "${YELLOW}⚠️  Found DynamoDB tables in us-west-2: $WEST_TABLES${NC}"
    echo "   These should be deleted after confirming us-east-1 is working"
    ((warnings++))
else
    echo -e "${GREEN}✅ No DynamoDB tables found in us-west-2${NC}"
fi

# Check for API Gateways in us-west-2
echo "Checking API Gateways in us-west-2..."
WEST_APIS=$(aws apigateway get-rest-apis --profile $AWS_PROFILE --region $OLD_REGION --query 'items[?starts_with(name, `heatherandwesley`)].name' --output text 2>/dev/null || echo "")
if [ -n "$WEST_APIS" ]; then
    echo -e "${YELLOW}⚠️  Found API Gateways in us-west-2: $WEST_APIS${NC}"
    echo "   These should be deleted after confirming us-east-1 is working"
    ((warnings++))
else
    echo -e "${GREEN}✅ No API Gateways found in us-west-2${NC}"
fi

echo ""
echo "🔧 Checking code for region references..."

# Check for hardcoded us-west-2 references in code
echo "Checking for us-west-2 references in code..."
WEST_REFS=$(grep -r "us-west-2" --include="*.py" --include="*.sh" --include="*.ts" --include="*.js" --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir="docs" --exclude-dir="tmp" . 2>/dev/null || echo "")
if [ -n "$WEST_REFS" ]; then
    echo -e "${RED}❌ Found us-west-2 references in code:${NC}"
    echo "$WEST_REFS"
    ((errors++))
else
    echo -e "${GREEN}✅ No us-west-2 references found in code${NC}"
fi

echo ""
echo "📊 Migration Verification Summary:"
echo "=================================="

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}🎉 Migration verification PASSED!${NC}"
    echo "   All resources are properly migrated to us-east-1"
    echo "   No leftover resources found in us-west-2"
    exit 0
elif [ $errors -eq 0 ] && [ $warnings -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Migration verification PASSED with WARNINGS${NC}"
    echo "   All required resources are in us-east-1"
    echo "   Found $warnings warnings about leftover resources in us-west-2"
    echo "   Consider running cleanup script when ready"
    exit 0
else
    echo -e "${RED}❌ Migration verification FAILED${NC}"
    echo "   Found $errors critical errors"
    echo "   Found $warnings warnings"
    echo "   Please resolve errors before proceeding"
    exit 1
fi