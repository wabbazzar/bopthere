#!/bin/bash
# Deploy leaderboard-handler Lambda function

# Set variables
FUNCTION_NAME="heatherandwesley-leaderboard-handler"
HANDLER="leaderboard-handler.lambda_handler"
RUNTIME="python3.9"
TIMEOUT=30
MEMORY=256
PROFILE="personal"
REGION="us-east-1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Deploying leaderboard handler Lambda function..."

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LAMBDA_DIR="$SCRIPT_DIR/../aws/lambda"

# Change to lambda directory
cd "$LAMBDA_DIR" || exit 1

# Create deployment package
echo "Creating deployment package..."
rm -rf package leaderboard-deployment.zip 2>/dev/null
mkdir package

# Install dependencies using PyPI
echo "Installing dependencies from PyPI..."
pip install --index-url https://pypi.org/simple/ -r requirements.txt -t package/ --quiet

# Copy handler
cp leaderboard-handler.py package/

# Create zip
cd package
zip -r ../leaderboard-deployment.zip . -q
cd ..

# Clean up
rm -rf package

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --region $REGION --query Account --output text)

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}✗ Failed to get AWS account ID${NC}"
    exit 1
fi

# Define IAM role ARN
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/heatherandwesley-lambda-role"

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --profile $PROFILE --region $REGION >/dev/null 2>&1; then
    echo "Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://leaderboard-deployment.zip \
        --profile $PROFILE \
        --region $REGION
    
    # Update configuration
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --environment Variables="{TABLE_NAME=heatherandwesley-leaderboard,AUTH_LAMBDA_NAME=heatherandwesley-auth-handler,ALLOWED_ORIGINS=\"https://heatherandwesley.com,http://localhost:5173,http://localhost:8080,http://localhost:8081\"}" \
        --profile $PROFILE \
        --region $REGION
else
    echo "Creating new function..."
    # Create IAM role if it doesn't exist
    if ! aws iam get-role --role-name heatherandwesley-lambda-role --profile $PROFILE >/dev/null 2>&1; then
        echo "Creating IAM role..."
        aws iam create-role \
            --role-name heatherandwesley-lambda-role \
            --assume-role-policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": {"Service": "lambda.amazonaws.com"},
                    "Action": "sts:AssumeRole"
                }]
            }' \
            --profile $PROFILE
        
        # Attach policies
        aws iam attach-role-policy \
            --role-name heatherandwesley-lambda-role \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
            --profile $PROFILE
        
        # Create and attach DynamoDB policy
        aws iam put-role-policy \
            --role-name heatherandwesley-lambda-role \
            --policy-name DynamoDBAccess \
            --policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": [
                        "dynamodb:Query",
                        "dynamodb:PutItem",
                        "dynamodb:DeleteItem",
                        "dynamodb:GetItem"
                    ],
                    "Resource": [
                        "arn:aws:dynamodb:*:*:table/heatherandwesley-leaderboard",
                        "arn:aws:dynamodb:*:*:table/heatherandwesley-users"
                    ]
                }]
            }' \
            --profile $PROFILE
        
        # Add Lambda invoke permissions
        aws iam put-role-policy \
            --role-name heatherandwesley-lambda-role \
            --policy-name LambdaInvokeAccess \
            --policy-document '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": "lambda:InvokeFunction",
                    "Resource": "arn:aws:lambda:*:*:function:heatherandwesley-auth-handler"
                }]
            }' \
            --profile $PROFILE
        
        # Wait for role to propagate
        echo "Waiting for IAM role to propagate..."
        sleep 10
    fi
    
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --zip-file fileb://leaderboard-deployment.zip \
        --environment Variables="{TABLE_NAME=heatherandwesley-leaderboard,AUTH_LAMBDA_NAME=heatherandwesley-auth-handler,ALLOWED_ORIGINS=\"https://heatherandwesley.com,http://localhost:5173,http://localhost:8080,http://localhost:8081\"}" \
        --profile $PROFILE \
        --region $REGION
fi

# Clean up deployment package
rm leaderboard-deployment.zip

# Return to original directory
cd "$SCRIPT_DIR" || exit 1

echo -e "${GREEN}✓ Leaderboard handler deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure API Gateway to route /leaderboard/* requests to this function"
echo "2. Test with: make test-leaderboard"
echo "3. Ensure the DynamoDB table 'heatherandwesley-leaderboard' exists"