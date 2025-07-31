# API Gateway Resources for Authentication

# API Gateway Resource for /auth
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_rest_api.wedding_api.root_resource_id
  path_part   = "auth"
}

# API Gateway Resource for /auth/login
resource "aws_api_gateway_resource" "auth_login" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "login"
}

# API Gateway Resource for /auth/verify
resource "aws_api_gateway_resource" "auth_verify" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "verify"
}

# API Gateway Resource for /auth/register
resource "aws_api_gateway_resource" "auth_register" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "register"
}

# OPTIONS method for CORS (for /auth/login)
resource "aws_api_gateway_method" "auth_login_options" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_login.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "auth_login_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_login.id
  http_method = aws_api_gateway_method.auth_login_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration" "auth_login_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_login.id
  http_method = aws_api_gateway_method.auth_login_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration_response" "auth_login_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_login.id
  http_method = aws_api_gateway_method.auth_login_options.http_method
  status_code = aws_api_gateway_method_response.auth_login_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# POST method for login
resource "aws_api_gateway_method" "auth_login_post" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_login.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_login_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_login.id
  http_method = aws_api_gateway_method.auth_login_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

resource "aws_api_gateway_method_response" "auth_login_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_login.id
  http_method = aws_api_gateway_method.auth_login_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# OPTIONS method for CORS (for /auth/verify)
resource "aws_api_gateway_method" "auth_verify_options" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_verify.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "auth_verify_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_verify.id
  http_method = aws_api_gateway_method.auth_verify_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration" "auth_verify_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_verify.id
  http_method = aws_api_gateway_method.auth_verify_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration_response" "auth_verify_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_verify.id
  http_method = aws_api_gateway_method.auth_verify_options.http_method
  status_code = aws_api_gateway_method_response.auth_verify_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# POST method for verify
resource "aws_api_gateway_method" "auth_verify_post" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_verify.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_verify_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_verify.id
  http_method = aws_api_gateway_method.auth_verify_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

resource "aws_api_gateway_method_response" "auth_verify_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_verify.id
  http_method = aws_api_gateway_method.auth_verify_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}

# OPTIONS method for CORS (for /auth/register)
resource "aws_api_gateway_method" "auth_register_options" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_register.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method_response" "auth_register_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_register.id
  http_method = aws_api_gateway_method.auth_register_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration" "auth_register_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_register.id
  http_method = aws_api_gateway_method.auth_register_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration_response" "auth_register_options" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_register.id
  http_method = aws_api_gateway_method.auth_register_options.http_method
  status_code = aws_api_gateway_method_response.auth_register_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# POST method for register
resource "aws_api_gateway_method" "auth_register_post" {
  rest_api_id   = aws_api_gateway_rest_api.wedding_api.id
  resource_id   = aws_api_gateway_resource.auth_register.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_register_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_register.id
  http_method = aws_api_gateway_method.auth_register_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

resource "aws_api_gateway_method_response" "auth_register_post" {
  rest_api_id = aws_api_gateway_rest_api.wedding_api.id
  resource_id = aws_api_gateway_resource.auth_register.id
  http_method = aws_api_gateway_method.auth_register_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
  }
}