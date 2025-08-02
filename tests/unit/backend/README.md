# Backend Unit Tests

This directory contains unit tests for AWS Lambda handlers and utility functions.

## Structure

- `handlers/` - Tests for Lambda function handlers
- `utils/` - Tests for utility functions (schema generators, extractors)

## Running Tests

```bash
# Run all backend unit tests
make test-unit-python

# Run specific test file
cd tests/unit/backend && pytest handlers/test_auth_handler.py -v

# Run with coverage
cd tests/unit/backend && pytest --cov=aws/lambda --cov-report=html
```

## Writing Tests

### Handler Tests
```python
import json
import pytest
from unittest.mock import patch, MagicMock

def test_lambda_handler_success():
    """Test successful Lambda invocation"""
    event = {
        "httpMethod": "POST",
        "body": json.dumps({"username": "test", "password": "test123"})
    }
    
    with patch('boto3.Session') as mock_session:
        # Mock DynamoDB responses
        mock_table = MagicMock()
        mock_session.return_value.resource.return_value.Table.return_value = mock_table
        
        from auth_handler import lambda_handler
        response = lambda_handler(event, {})
        
        assert response["statusCode"] == 200
```

### Best Practices
- Mock AWS services (DynamoDB, S3, etc.)
- Test error handling and edge cases
- Validate request/response schemas
- Use fixtures for common test data