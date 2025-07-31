#!/bin/bash
# Wrapper script for OpenTofu with macOS workarounds

# Set extended timeout
export TF_PLUGIN_TIMEOUT=600

# Disable provider development overrides
unset TF_DEV_OVERRIDES

# Clear any problematic environment variables
unset TF_CLI_CONFIG_FILE

# Run OpenTofu with the provided arguments
exec tofu "$@"