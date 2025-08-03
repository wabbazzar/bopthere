variable "aws_profile" {
  description = "AWS profile to use for authentication"
  type        = string
  default     = "personal"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "table_name" {
  description = "DynamoDB table name for RSVP responses"
  type        = string
  default     = "heatherandwesley-users"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function for RSVP handling"
  type        = string
  default     = "heatherandwesley-rsvp-handler"
}

variable "api_gateway_name" {
  description = "Name of the API Gateway"
  type        = string
  default     = "heatherandwesley-api"
}

variable "allowed_origins" {
  description = "Allowed CORS origins for API Gateway"
  type        = list(string)
  default     = ["https://heatherandwesley.com", "http://localhost:5173", "http://localhost:5174"]
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "heatherandwesley"
}

variable "jwt_secret" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
  default     = "your-secret-key-change-in-production"
}