#!/bin/bash
# Deploy auth-handler Lambda function

# Set variables
FUNCTION_NAME="heatherandwesley-auth"
HANDLER="auth-handler.lambda_handler"
RUNTIME="python3.9"
TIMEOUT=30
MEMORY=256
REGION="us-west-2"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Deploying auth handler Lambda function..."

# Create deployment package
echo "Creating deployment package..."
rm -rf package auth-deployment.zip 2>/dev/null
mkdir package

# Install dependencies
pip install -r requirements.txt -t package/ --quiet

# Copy handler
cp auth-handler.py package/

# Create zip
cd package
zip -r ../auth-deployment.zip . -q
cd ..

# Clean up
rm -rf package

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION >/dev/null 2>&1; then
    echo "Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://auth-deployment.zip \
        --region $REGION
else
    echo "Creating new function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --zip-file fileb://auth-deployment.zip \
        --environment Variables="{TABLE_NAME=heatherandwesley-users,JWT_SECRET=your-production-secret-here}" \
        --region $REGION
fi

# Clean up deployment package
rm auth-deployment.zip

echo -e "${GREEN}✓ Auth handler deployed successfully!${NC}"
echo ""
echo "Remember to:"
echo "1. Update the IAM role ARN in this script"
echo "2. Set a secure JWT_SECRET in environment variables"
echo "3. Configure API Gateway to route /auth/* requests to this function"
echo "4. Ensure the DynamoDB table 'heatherandwesley-users' exists"