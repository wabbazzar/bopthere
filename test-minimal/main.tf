provider "aws" {
  region  = "us-west-2"
  profile = "personal"
}

data "aws_caller_identity" "current" {}