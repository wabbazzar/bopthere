# Integration Tests

This directory contains tests that verify integration between multiple components or services.

## Structure

- `frontend/` - React component integration with APIs
- `backend/` - Lambda integration with DynamoDB and other AWS services

## Frontend Integration Tests

Test React components with actual API calls (using MSW or similar):
- Form submissions to API endpoints
- Data fetching and state management
- Error handling across components

## Backend Integration Tests

Test Lambda functions with actual AWS service interactions:
- DynamoDB operations
- API Gateway integration
- Cross-service workflows

## Running Tests

```bash
# Run all integration tests
make test-integration-python

# Run specific backend integration test
cd tests/integration/backend && pytest test_api_field_consistency.py -v
```

## Best Practices
- Use test databases/tables when possible
- Clean up test data after each test
- Test realistic scenarios and edge cases
- Verify data consistency across services