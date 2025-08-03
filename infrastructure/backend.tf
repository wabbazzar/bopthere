# Backend configuration for OpenTofu state
# Note: S3 bucket and DynamoDB table for state locking should be created manually
# or through a separate bootstrap process

terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}

# For production use, uncomment and configure S3 backend:
# terraform {
#   backend "s3" {
#     bucket         = "heatherandwesley-terraform-state"
#     key            = "infrastructure/terraform.tfstate"
#     region         = "us-east-1"
#     profile        = "personal"
#     dynamodb_table = "heatherandwesley-terraform-locks"
#     encrypt        = true
#   }
# }