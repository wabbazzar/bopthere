# Ticket 013: Test Infrastructure Improvements and Quality Assurance

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 13 points
- **Created**: 2025-08-04
- **Type**: chore
- **Character Impact**: All

## User Stories

### Primary User Story
As a developer, I want comprehensive test infrastructure with proper cleanup and formatting so that I can confidently deploy code without breaking the production wedding app.

### Secondary User Stories
- As a developer, I want all tests to pass consistently so that I can trust the build process
- As a developer, I want automated code formatting so that code style is consistent across the project
- As a developer, I want test data cleanup so that tests don't interfere with each other or production data
- As a CI/CD system, I want reliable test execution so that deployments are safe

## Technical Requirements

### Functional Requirements
1. All tests in `make test-all` must pass completely
2. Implement `make format` command that runs comprehensive linting and formatting
3. Ensure all tests clean up any data they create in backend systems
4. Tests must be isolated and not depend on external state
5. Frontend and backend tests must follow wedding app character system patterns

### Non-Functional Requirements
1. Performance: Test execution should complete within 5 minutes for full suite
2. Reliability: Tests should pass consistently (>95% success rate)
3. Maintainability: Test code should follow project standards and be well-documented
4. Security: Test credentials and data should not leak into production systems

## Implementation Plan

### Phase 1: Test Failure Analysis and Resolution (4 points)
**Files to modify:**
- `tests/e2e/smoke/conftest.py` - Fix API Gateway URL discovery
- `tests/e2e/smoke/test_rsvp_flow_smoke.py` - Fix RSVP flow tests
- `tests/e2e/smoke/test_leaderboard_smoke.py` - Fix leaderboard tests
- `tests/e2e/smoke/test_migration_verification.py` - Fix migration tests

**Current Issues Identified:**
1. API Gateway URL hardcoded to placeholder in smoke tests
2. Connection errors to `your-api-gateway-url.execute-api.us-east-1.amazonaws.com`
3. Missing test data cleanup in some RSVP flow tests
4. Authentication token issues in leaderboard tests

**Implementation steps:**
1. Update `conftest.py` to properly discover API Gateway URL from environment or AWS API
2. Fix hardcoded placeholder URL in test configuration
3. Ensure all smoke tests use dynamic API Gateway discovery
4. Add proper error handling for AWS service discovery failures
5. Verify test isolation by running tests multiple times

**Testing:**
```bash
cd tests/e2e/smoke && pytest -v --tb=short
make test-all
```

**Commit**: `test(smoke): fix API Gateway URL discovery and connection issues`

### Phase 2: Implement Format Command with Pre-commit Checks (3 points)
**Files to create/modify:**
- `Makefile` - Add `format` target
- `.pre-commit-config.yaml` - Create pre-commit configuration
- `package.json` - Add formatting scripts
- `eslint.config.js` - Enhance linting rules

**Pre-commit Tools to Include:**
1. **ESLint** - JavaScript/TypeScript linting with React hooks rules
2. **Prettier** - Code formatting for JS/TS/JSON/MD files
3. **Black** - Python code formatting
4. **isort** - Python import sorting
5. **flake8** - Python linting
6. **mypy** - Python type checking

**Implementation steps:**
1. Create comprehensive `make format` command that runs:
   - `npm run lint:fix` (ESLint with auto-fix)
   - `npm run format` (Prettier formatting)
   - `black tests/ scripts/ aws/` (Python formatting)
   - `isort tests/ scripts/ aws/` (Import sorting)
   - `flake8 tests/ scripts/ aws/` (Python linting)
2. Add pre-commit configuration file
3. Update package.json with formatting scripts
4. Enhance ESLint config to fix React hooks warnings
5. Add pre-commit installation to development setup

**Testing:**
```bash
make format
npm run lint
cd tests/unit/backend && python -m flake8 .
```

**Commit**: `chore(format): implement comprehensive formatting and linting pipeline`

### Phase 3: Enhanced Test Data Cleanup System (3 points)
**Files to modify:**
- `tests/e2e/smoke/conftest.py` - Enhance cleanup tracking
- `tests/e2e/smoke/test_*.py` - Update all smoke tests to use cleanup
- `tests/integration/backend/test_*.py` - Add cleanup to integration tests
- `tests/unit/backend/handlers/test_*.py` - Mock DynamoDB for unit tests

**Cleanup Strategy:**
1. **Session-level cleanup** - Clean up data created during entire test session
2. **Test-level cleanup** - Clean up data created by individual tests
3. **Fixture-based tracking** - Automatic tracking of created resources
4. **Graceful failure handling** - Continue cleanup even if some items fail to delete

**Implementation steps:**
1. Enhance `cleanup_tracker` fixture to handle all resource types:
   - RSVP entries (`heatherandwesley-users` table)
   - Auth users (`heatherandwesley-auth-users` table)
   - Leaderboard scores (`heatherandwesley-leaderboard` table)
2. Add automatic cleanup verification to ensure data is properly removed
3. Implement test isolation prefixes (e.g., `test_session_XXXXXX_`) for all test data
4. Add cleanup verification function to ensure no test data remains
5. Update all smoke and integration tests to use proper cleanup fixtures
6. Mock DynamoDB in unit tests to avoid creating any real data

**Testing:**
```bash
cd tests/e2e/smoke && pytest test_rsvp_flow_smoke.py::TestRSVPFlowE2E::test_data_cleanup -v
make test-e2e-smoke
```

**Commit**: `test(cleanup): implement comprehensive test data cleanup system`

### Phase 4: Frontend Test Infrastructure Improvements (2 points)
**Files to modify:**
- `src/components/__tests__/` - Create component tests
- `jest.config.js` - Create Jest configuration
- `tests/unit/frontend/` - Organize frontend unit tests
- `tests/e2e/playwright/` - Enhance Playwright tests

**Jest Configuration:**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/unit/frontend/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx'
  ]
};
```

**Implementation steps:**
1. Create Jest configuration file with proper setup
2. Add test setup file with character context mocks
3. Create sample component tests for character system integration
4. Ensure Jest tests clean up any localStorage or sessionStorage data
5. Update Playwright tests to clean up browser state between tests

**Testing:**
```bash
npm test
npm run test:coverage
npx playwright test tests/e2e/playwright/
```

**Commit**: `test(frontend): enhance Jest configuration and component testing`

### Phase 5: Test Documentation and Makefile Integration (1 point)
**Files to modify:**
- `Makefile` - Update test targets
- `tests/README.md` - Update testing documentation
- `CLAUDE.md` - Update testing guidelines

**New Makefile Targets:**
```makefile
# Enhanced test targets
test-format: ## Run formatting checks without applying fixes
	@echo "Checking code formatting..."
	npm run lint
	black --check tests/ scripts/ aws/
	isort --check-only tests/ scripts/ aws/
	flake8 tests/ scripts/ aws/

format: ## Apply all formatting and linting fixes
	@echo "Applying code formatting..."
	npm run lint:fix || true
	npm run format || true
	black tests/ scripts/ aws/
	isort tests/ scripts/ aws/
	@echo "Formatting complete!"

test-clean: ## Clean up all test data and artifacts
	@echo "Cleaning up test data..."
	cd tests/e2e/smoke && python -c "from conftest import _cleanup_test_data; _cleanup_test_data({'users': [], 'rsvps': [], 'scores': []})"
	rm -rf .coverage .pytest_cache tests/__pycache__ tests/*/__pycache__
	rm -rf test-results/ playwright-report/
	@echo "Test cleanup complete!"

test-all-clean: test-clean test-all ## Clean and run all tests
```

**Implementation steps:**
1. Update all Makefile test targets to include cleanup
2. Document test data cleanup procedures
3. Add troubleshooting section to test README
4. Update CLAUDE.md with new testing workflow
5. Ensure all test commands are idempotent

**Testing:**
```bash
make test-format
make format
make test-clean
make test-all-clean
```

**Commit**: `docs(test): update documentation and Makefile for new test infrastructure`

## Testing Strategy

### Test Infrastructure Verification
- Verify `make test-all` passes completely on clean checkout
- Verify `make format` processes all files without errors
- Verify test data cleanup by running tests multiple times
- Verify no test data remains in production tables after test runs

### Character System Integration Tests
- Test that frontend tests properly mock character context
- Test that backend tests work with all three character perspectives
- Verify RSVP flow tests work with Wesley, Heather, and Puffy themes

### Performance and Reliability Tests
- Run full test suite 5 times to verify consistency
- Measure test execution time for optimization opportunities
- Verify tests pass in parallel execution (where applicable)

### CI/CD Integration Tests
- Verify all formatting checks pass in fresh environment
- Test build process after formatting changes
- Verify no secrets or production data in test artifacts

## Documentation Updates Required
1. Update `tests/README.md` with new cleanup procedures and format command
2. Add troubleshooting section for common test failures
3. Document test data isolation strategy
4. Add pre-commit setup instructions to development workflow

## Success Criteria
1. `make test-all` passes completely (0 failed tests)
2. `make format` command exists and processes all code files
3. No test data remains in production DynamoDB tables after test execution
4. Test suite can be run multiple times consecutively without failures
5. All linting warnings from ESLint are resolved
6. Test execution time is under 5 minutes for full suite

## Dependencies
- AWS CLI configured with `personal` profile
- Node.js with npm for frontend tooling
- Python with pytest for backend testing
- DynamoDB tables properly configured in us-east-1
- API Gateway deployed and accessible

## Risks & Mitigations
1. **Risk**: Test cleanup might accidentally delete production data
   **Mitigation**: Use test-specific prefixes and separate test environment validation
2. **Risk**: Format command might introduce breaking changes
   **Mitigation**: Run full test suite after formatting changes
3. **Risk**: Some tests might fail due to AWS service dependencies
   **Mitigation**: Implement proper mocking for unit tests and graceful degradation for integration tests
4. **Risk**: Character system tests might be complex to maintain
   **Mitigation**: Create reusable test fixtures and helper functions for character context

## Field Reference

### API Endpoints Used in Tests
- `POST /rsvp` - RSVP submission
- `GET /rsvp?email={email}` - RSVP retrieval
- `POST /auth/login` - User authentication
- `POST /auth/verify` - Token verification
- `GET /leaderboard/{game}` - Leaderboard retrieval
- `POST /leaderboard/{game}` - Score submission

### DynamoDB Tables and Cleanup Fields
- `heatherandwesley-users` table: `id` (primary key for cleanup)
- `heatherandwesley-auth-users` table: `username` (primary key for cleanup)
- `heatherandwesley-leaderboard` table: `game`, `score_timestamp` (composite key for cleanup)

### Environment Variables
- `VITE_API_GATEWAY_URL` - API Gateway base URL for tests
- `JWT_SECRET` - JWT secret for token validation tests
- `AWS_PROFILE=personal` - AWS profile for all operations
- `AWS_REGION=us-east-1` - AWS region for all resources