# Provider configurations
provider "archive" {}

# Terraform settings for provider installation
terraform {
  # Provider plugin cache directory (optional, helps with timeout issues)
  # Uncomment the following if you continue to have timeout issues:
  # plugin_cache_dir = "$HOME/.terraform.d/plugin-cache"
}