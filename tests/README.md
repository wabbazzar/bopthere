# Wedding App Test Suite

This directory contains all tests for the Wedding App, organized by test type and technology.

## Directory Structure

```
tests/
├── unit/                    # Fast, isolated tests
│   ├── frontend/           # React component tests (Jest)
│   └── backend/            # Python Lambda/utils tests (pytest)
├── integration/            # Tests with external dependencies
│   ├── frontend/           # React + API integration tests
│   └── backend/            # Lambda + DynamoDB tests
└── e2e/                    # End-to-end tests
    ├── playwright/         # Browser automation tests
    └── smoke/              # API smoke tests
```

## Running Tests

### All Tests
```bash
make test-all-new
```

### By Technology
```bash
make test-python      # All Python tests
make test-frontend    # All frontend tests
```

### By Test Type
```bash
make test-unit-python         # Python unit tests
make test-unit-frontend       # Jest unit tests
make test-integration-python  # Python integration tests
make test-e2e-playwright      # Playwright browser tests
make test-e2e-smoke          # API smoke tests
```

## Test Guidelines

1. **Unit Tests**: Should be fast, isolated, and mock external dependencies
2. **Integration Tests**: Test interaction between components/services
3. **E2E Tests**: Test complete user flows through the application

## Writing New Tests

- Place tests in the appropriate directory based on type and technology
- Follow existing naming conventions:
  - Python: `test_*.py`
  - JavaScript/TypeScript: `*.test.ts` or `*.spec.ts`
- Include character system testing for all frontend features
- Ensure mobile responsiveness is tested