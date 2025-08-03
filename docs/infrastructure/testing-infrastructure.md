# Testing Infrastructure Documentation

## Overview

The wedding app includes a comprehensive testing infrastructure designed to ensure code quality, system reliability, and successful deployments. This document describes the testing strategy, tools, and procedures for maintaining high-quality software.

## Testing Philosophy

### Quality Gates
1. **Pre-commit**: Fast checks to catch obvious issues early
2. **Pre-push**: Comprehensive testing before deployment
3. **Continuous Integration**: Automated testing on code changes
4. **Production Monitoring**: Health checks and alerting

### Test Pyramid Structure
```
    /\     E2E & Smoke Tests (Few, Expensive, Slow)
   /  \    
  /____\   Integration Tests (Some, Moderate Cost)
 /______\  
/_________\ Unit Tests (Many, Cheap, Fast)
```

## Test Types and Organization

### Directory Structure
```
tests/
├── unit/
│   ├── frontend/          # Jest tests for React components
│   │   ├── components/    # Component unit tests
│   │   ├── contexts/      # Context provider tests  
│   │   ├── hooks/         # Custom hook tests
│   │   └── utils/         # Utility function tests
│   └── backend/           # Python tests for Lambda/API logic
│       ├── handlers/      # Lambda handler tests
│       └── utils/         # Utility function tests
├── integration/
│   ├── frontend/          # React + API integration tests
│   │   └── flows/         # Complete user flow tests
│   └── backend/           # Lambda + DynamoDB integration tests
│       ├── api/           # API endpoint integration tests
│       └── database/      # Database operation tests
├── e2e/
│   ├── playwright/        # Browser automation tests
│   │   ├── auth/          # Authentication flow tests
│   │   ├── rsvp/          # RSVP flow tests
│   │   └── navigation/    # Navigation and UI tests
│   └── smoke/             # API smoke tests for critical paths
│       ├── auth/          # Authentication smoke tests
│       ├── rsvp/          # RSVP smoke tests
│       └── leaderboard/   # Leaderboard smoke tests
```

## Unit Tests

### Frontend Unit Tests (Jest)

**Purpose**: Test individual React components, hooks, and utilities in isolation

**Technology Stack**:
- Jest - Test runner and assertion library
- React Testing Library - Component testing utilities
- Mock Service Worker (MSW) - API mocking

**Running Tests**:
```bash
# Run all frontend unit tests
make test-unit-frontend

# Run tests in watch mode (development)
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- ComponentName.test.tsx
```

**Test Structure Example**:
```typescript
// src/components/__tests__/CharacterCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterCard } from '../CharacterCard';
import { CharacterProvider } from '../../contexts/CharacterContext';

describe('CharacterCard', () => {
  it('displays character name and description', () => {
    render(
      <CharacterProvider>
        <CharacterCard character="wesley" />
      </CharacterProvider>
    );
    
    expect(screen.getByText('Wesley')).toBeInTheDocument();
    expect(screen.getByText(/adventure/i)).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const mockOnSelect = jest.fn();
    render(
      <CharacterProvider>
        <CharacterCard character="wesley" onSelect={mockOnSelect} />
      </CharacterProvider>
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnSelect).toHaveBeenCalledWith('wesley');
  });
});
```

### Backend Unit Tests (Python/pytest)

**Purpose**: Test Lambda handlers, utility functions, and business logic

**Technology Stack**:
- pytest - Test runner and fixture management
- moto - AWS service mocking
- pytest-mock - Mock and stub utilities

**Running Tests**:
```bash
# Run all backend unit tests
make test-unit-python

# Run with verbose output
cd tests/unit/backend && pytest -v

# Run specific test file
cd tests/unit/backend && pytest handlers/test_auth_handler.py

# Run with coverage
cd tests/unit/backend && pytest --cov=../../../aws/lambda
```

**Test Structure Example**:
```python
# tests/unit/backend/handlers/test_auth_handler.py
import pytest
from moto import mock_dynamodb
import boto3
from aws.lambda.auth_handler import lambda_handler

@pytest.fixture
def mock_table():
    with mock_dynamodb():
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='test-auth-users',
            KeySchema=[{'AttributeName': 'username', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'username', 'AttributeType': 'S'}],
            BillingMode='PAY_PER_REQUEST'
        )
        yield table

def test_login_success(mock_table):
    # Setup test user
    mock_table.put_item(Item={
        'username': 'testuser',
        'password_hash': 'hashed_password',
        'role': 'guest'
    })
    
    event = {
        'httpMethod': 'POST',
        'body': '{"username": "testuser", "password": "password"}'
    }
    
    response = lambda_handler(event, {})
    
    assert response['statusCode'] == 200
    assert 'token' in response['body']
```

## Integration Tests

### Frontend Integration Tests

**Purpose**: Test complete user flows that span multiple components and API calls

**Running Tests**:
```bash
# Run frontend integration tests
make test-integration-frontend

# These are included in the standard npm test command
npm test -- --testPathPattern=integration
```

**Example**:
```typescript
// tests/integration/frontend/flows/test_rsvp_flow.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../../src/App';
import { server } from '../../mocks/server';

describe('RSVP Flow Integration', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('completes full RSVP submission flow', async () => {
    render(<App />);
    
    // Select character
    fireEvent.click(screen.getByText('Choose Wesley'));
    
    // Navigate to RSVP
    fireEvent.click(screen.getByText('RSVP'));
    
    // Fill form
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Test Guest' }
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' }
    });
    
    // Submit
    fireEvent.click(screen.getByText('Submit RSVP'));
    
    // Verify success
    await waitFor(() => {
      expect(screen.getByText('Thank you for your RSVP!')).toBeInTheDocument();
    });
  });
});
```

### Backend Integration Tests

**Purpose**: Test API Gateway → Lambda → DynamoDB integration chains

**Running Tests**:
```bash
# Run backend integration tests
make test-integration-python

# Run specific integration test
cd tests/integration/backend && pytest api/test_rsvp_integration.py
```

**Example**:
```python
# tests/integration/backend/api/test_rsvp_integration.py
import pytest
import boto3
from moto import mock_dynamodb, mock_lambda
import json

@pytest.fixture
def aws_environment():
    with mock_dynamodb(), mock_lambda():
        # Setup DynamoDB table
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='heatherandwesley-users',
            KeySchema=[{'AttributeName': 'id', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'id', 'AttributeType': 'S'}],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # Setup Lambda function
        lambda_client = boto3.client('lambda', region_name='us-east-1')
        # ... Lambda setup code
        
        yield {'table': table, 'lambda_client': lambda_client}

def test_rsvp_submission_integration(aws_environment):
    """Test complete RSVP submission from API to database"""
    event = {
        'httpMethod': 'POST',
        'body': json.dumps({
            'name': 'Test Guest',
            'email': 'test@example.com',
            'attendance': 'yes'
        })
    }
    
    # Invoke Lambda handler
    from aws.lambda.rsvp_handler import lambda_handler
    response = lambda_handler(event, {})
    
    # Verify response
    assert response['statusCode'] == 200
    
    # Verify data was written to DynamoDB
    table = aws_environment['table']
    response_body = json.loads(response['body'])
    item = table.get_item(Key={'id': response_body['id']})
    
    assert item['Item']['name'] == 'Test Guest'
    assert item['Item']['email'] == 'test@example.com'
```

## End-to-End Tests

### Playwright Browser Tests

**Purpose**: Test complete user journeys in real browsers

**Setup**:
```bash
# Install Playwright (if not already installed)
npm install -D @playwright/test
npx playwright install chromium
```

**Running Tests**:
```bash
# Run all Playwright tests
make test-e2e-playwright

# Run with UI (development)
npx playwright test --ui

# Run specific test
npx playwright test tests/e2e/playwright/auth/login.spec.ts
```

**Configuration** (`playwright.config.ts`):
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Test Example**:
```typescript
// tests/e2e/playwright/rsvp/rsvp-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('RSVP Flow', () => {
  test('complete RSVP submission as Wesley character', async ({ page }) => {
    await page.goto('/');
    
    // Select Wesley character
    await page.click('[data-character="wesley"]');
    await expect(page.locator('h1')).toContainText('Wesley');
    
    // Navigate to RSVP
    await page.click('text=RSVP');
    await expect(page).toHaveURL(/.*rsvp/);
    
    // Fill RSVP form
    await page.fill('[data-testid="name-input"]', 'Test Guest');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.selectOption('[data-testid="attendance-select"]', 'yes');
    
    // Submit form
    await page.click('[data-testid="submit-rsvp"]');
    
    // Verify success
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText('Thank you');
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('/rsvp');
    
    // Try to submit empty form
    await page.click('[data-testid="submit-rsvp"]');
    
    // Verify validation errors
    await expect(page.locator('.error-message')).toContainText('Name is required');
    await expect(page.locator('.error-message')).toContainText('Email is required');
  });
});
```

### API Smoke Tests

**Purpose**: Verify critical API endpoints are working in production

**Running Tests**:
```bash
# Run all smoke tests
make test-e2e-smoke

# Run integration smoke tests (no AWS required)
make test-e2e-smoke-integration

# Run specific smoke test
cd tests/e2e/smoke && pytest auth/test_auth_smoke.py
```

**Test Example**:
```python
# tests/e2e/smoke/auth/test_auth_smoke.py
import pytest
import requests
import os

@pytest.fixture
def api_base_url():
    """Get API Gateway base URL from environment or AWS"""
    url = os.getenv('API_GATEWAY_URL')
    if not url:
        # Discover API Gateway URL dynamically
        import boto3
        client = boto3.client('apigateway', region_name='us-east-1', profile_name='personal')
        apis = client.get_rest_apis()
        api = next((api for api in apis['items'] if api['name'] == 'heatherandwesley-api'), None)
        if api:
            url = f"https://{api['id']}.execute-api.us-east-1.amazonaws.com/prod"
    
    assert url, "API Gateway URL not found"
    return url

def test_auth_login_smoke(api_base_url):
    """Smoke test for authentication login"""
    response = requests.post(
        f"{api_base_url}/auth/login",
        json={
            "username": "testguest",
            "password": "wedding2025"
        },
        timeout=10
    )
    
    assert response.status_code == 200
    data = response.json()
    assert 'token' in data
    assert data['user']['role'] == 'guest'

def test_health_endpoint_smoke(api_base_url):
    """Smoke test for health endpoint"""
    response = requests.get(f"{api_base_url}/health", timeout=10)
    
    assert response.status_code == 200
    data = response.json()
    assert data['status'] in ['healthy', 'degraded']
    assert data['region'] == 'us-east-1'
    assert 'services' in data
```

## Git Hooks Implementation

### Pre-commit Hook

**Location**: `.git/hooks/pre-commit`

**Purpose**: Fast quality checks before commits

**Checks Performed**:
1. ESLint for frontend code quality
2. Python unit tests
3. Frontend unit tests
4. AWS region consistency check

**Example Output**:
```
🔍 Running pre-commit checks...
📝 Checking frontend code quality...
✅ ESLint passed
🧪 Running Python unit tests...
✅ Python unit tests passed (15 tests, 2.3s)
🎯 Running frontend unit tests...
✅ Frontend unit tests passed (42 tests, 5.1s)
🌍 Checking AWS region consistency...
✅ No us-west-2 references found
✅ Pre-commit checks passed!
```

### Pre-push Hook

**Location**: `.git/hooks/pre-push`

**Purpose**: Comprehensive testing before deployment

**Checks Performed**:
1. All Python tests (unit + integration)
2. Essential smoke tests
3. Migration verification
4. Build verification

**Example Output**:
```
🚀 Running pre-push checks...
🧪 Running all Python tests...
✅ Python tests passed (87 tests, 12.4s)
💨 Running essential smoke tests...
✅ Smoke tests passed (5 tests, 8.2s)
🔄 Verifying migration status...
✅ All resources confirmed in us-east-1
✅ Pre-push checks passed!
```

## Continuous Integration

### GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          npm ci
          pip install poetry
          poetry install
      
      - name: Run frontend unit tests
        run: npm test -- --coverage --watchAll=false
      
      - name: Run backend unit tests
        run: cd tests/unit/backend && pytest --cov=../../../aws/lambda
  
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: |
          cd tests/integration/backend && pytest
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - name: Install Playwright
        run: |
          npm ci
          npx playwright install --with-deps chromium
      
      - name: Start dev server
        run: npm run dev &
      
      - name: Run Playwright tests
        run: npx playwright test
      
      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Testing Best Practices

### Test Writing Guidelines

1. **Arrange-Act-Assert Pattern**:
   ```javascript
   it('should calculate correct total', () => {
     // Arrange
     const items = [{ price: 10 }, { price: 20 }];
     
     // Act
     const total = calculateTotal(items);
     
     // Assert
     expect(total).toBe(30);
   });
   ```

2. **Descriptive Test Names**:
   - ✅ `should return 401 when user provides invalid credentials`
   - ❌ `test login`

3. **Test Data Management**:
   ```python
   # Use factories or fixtures for consistent test data
   @pytest.fixture
   def sample_rsvp():
       return {
           'name': 'Test Guest',
           'email': 'test@example.com',
           'attendance': 'yes'
       }
   ```

4. **Mock External Dependencies**:
   ```typescript
   // Mock API calls in unit tests
   jest.mock('../services/api', () => ({
     submitRSVP: jest.fn().mockResolvedValue({ id: '123' })
   }));
   ```

### Test Maintenance

1. **Regular Review**: Review and update tests during code reviews
2. **Flaky Test Management**: Identify and fix flaky tests promptly
3. **Coverage Goals**: Maintain >80% code coverage for critical paths
4. **Performance**: Keep unit tests under 10ms, integration tests under 1s

## Debugging Tests

### Common Issues and Solutions

**Test Timeouts**:
```bash
# For Playwright tests
npx playwright test --timeout=60000

# For Jest tests
npm test -- --testTimeout=10000
```

**Mock Issues**:
```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

**Environment Variables**:
```bash
# Set test environment variables
export NODE_ENV=test
export API_GATEWAY_URL=http://localhost:3001
```

### Test Debugging Tools

1. **VS Code Test Explorer**: Built-in test runner and debugger
2. **Playwright Trace Viewer**: Visual debugging for E2E tests
3. **Chrome DevTools**: For debugging frontend tests
4. **pytest -pdb**: Python debugger integration

## Performance and Monitoring

### Test Execution Times

**Target Times**:
- Unit tests: < 10 seconds total
- Integration tests: < 30 seconds total
- Smoke tests: < 60 seconds total
- Full E2E suite: < 5 minutes total

**Monitoring**:
```bash
# Measure test execution time
time make test-all-new

# Profile specific test suites
cd tests/unit/backend && pytest --durations=10
```

### Test Metrics

Track and monitor:
- Test execution time trends
- Test failure rates
- Code coverage percentages
- Flaky test frequency

## Conclusion

The testing infrastructure provides comprehensive coverage across all layers of the wedding app, ensuring:

- **Quality**: Multiple levels of testing catch issues early
- **Confidence**: Automated testing enables safe deployments
- **Maintainability**: Well-organized tests support long-term development
- **Performance**: Fast feedback loops support developer productivity

This infrastructure supports the wedding app's reliability requirements while maintaining developer velocity and code quality.