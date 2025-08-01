# Authentication Lambda Function
resource "aws_lambda_function" "auth_handler" {
  function_name = "${var.project_name}-auth-handler"
  role          = aws_iam_role.auth_lambda_execution_role.arn
  handler       = "auth-handler.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 256

  filename         = "auth-lambda-deployment.zip"
  source_code_hash = filebase64sha256("auth-lambda-deployment.zip")

  environment {
    variables = {
      TABLE_NAME  = aws_dynamodb_table.auth_users.name
      JWT_SECRET  = var.jwt_secret
    }
  }

  tags = {
    Name        = "Wedding Auth Handler"
    Description = "Handles user authentication for the wedding app"
  }
}

# IAM role for Auth Lambda execution
resource "aws_iam_role" "auth_lambda_execution_role" {
  name = "${var.project_name}-auth-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Auth Lambda to access DynamoDB
resource "aws_iam_policy" "auth_lambda_dynamodb_policy" {
  name        = "${var.project_name}-auth-lambda-dynamodb-policy"
  description = "Allow Auth Lambda to access DynamoDB table for authentication"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          aws_dynamodb_table.auth_users.arn,
          "${aws_dynamodb_table.auth_users.arn}/index/*"
        ]
      }
    ]
  })
}

# Attach policies to Auth Lambda execution role
resource "aws_iam_role_policy_attachment" "auth_lambda_logs" {
  role       = aws_iam_role.auth_lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "auth_lambda_dynamodb" {
  role       = aws_iam_role.auth_lambda_execution_role.name
  policy_arn = aws_iam_policy.auth_lambda_dynamodb_policy.arn
}

# CloudWatch Log Group for Auth Lambda
resource "aws_cloudwatch_log_group" "auth_lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-auth-handler"
  retention_in_days = 14
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "auth_lambda_apigateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.wedding_api.execution_arn}/*/*"
}