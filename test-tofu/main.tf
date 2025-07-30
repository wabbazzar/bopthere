terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

# Simple local file resource for testing
resource "local_file" "test" {
  content  = "Hello from OpenTofu!"
  filename = "test_output.txt"
}

output "test_message" {
  value = "OpenTofu is working correctly!"
}