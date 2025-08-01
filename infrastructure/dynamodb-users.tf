# DynamoDB table for user authentication
resource "aws_dynamodb_table" "auth_users" {
  name         = "heatherandwesley-auth-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"

  attribute {
    name = "username"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Wedding App Authentication Users"
    Description = "Stores user authentication data for wedding app"
    Environment = "Production"
  }
}

# Output the table name for reference
output "auth_users_table_name" {
  description = "Name of the authentication users DynamoDB table"
  value       = aws_dynamodb_table.auth_users.name
}

output "auth_users_table_arn" {
  description = "ARN of the authentication users DynamoDB table"
  value       = aws_dynamodb_table.auth_users.arn
}