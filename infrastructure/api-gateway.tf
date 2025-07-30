# API Gateway REST API
resource "aws_api_gateway_rest_api" "wedding_api" {
  name        = var.api_gateway_name
  description = "API Gateway for wedding RSVP submissions"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API Gateway Resource for /rsvp
resource "aws_api_gateway_resource" "rsvp" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_rest_api.wedding_api.root_resource_id
  path_part   = "rsvp"
}

# API Gateway Resource for /rsvp/{id}
resource "aws_api_gateway_resource" "rsvp_id" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_resource.rsvp.id
  path_part   = "{id}"
}

# OPTIONS method for CORS (for /rsvp)
resource "aws_api_gateway_method" "rsvp_options" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.rsvp.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "rsvp_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.rsvp.id
  http_method = aws_api_gateway_method.rsvp_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration" "rsvp_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.rsvp.id
  http_method = aws_api_gateway_method.rsvp_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration_response" "rsvp_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.rsvp.id
  http_method = aws_api_gateway_method.rsvp_options.http_method
  status_code = aws_api_gateway_method_response.rsvp_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# POST method for RSVP submission
resource "aws_api_gateway_method" "rsvp_post" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.rsvp.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "rsvp_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.rsvp.id
  http_method = aws_api_gateway_method.rsvp_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.rsvp_handler.invoke_arn
}

resource "aws_api_gateway_method_response" "rsvp_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.rsvp.id
  http_method = aws_api_gateway_method.rsvp_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# GET method for retrieving RSVP by ID
resource "aws_api_gateway_method" "rsvp_get" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.rsvp_id.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "rsvp_get" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.rsvp_id.id
  http_method = aws_api_gateway_method.rsvp_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.rsvp_handler.invoke_arn
}

resource "aws_api_gateway_method_response" "rsvp_get" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.rsvp_id.id
  http_method = aws_api_gateway_method.rsvp_get.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  stage_name  = "prod"

  depends_on = [
    aws_api_gateway_integration.rsvp_options,
    aws_api_gateway_integration.rsvp_post,
    aws_api_gateway_integration.rsvp_get,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.api_gateway_name}"
  retention_in_days = 14
}

# API Gateway Stage with logging
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  stage_name    = "prod"

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      sourceIp       = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
    })
  }
}