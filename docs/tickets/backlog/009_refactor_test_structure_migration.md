# Ticket 009: Test Structure Migration to Organized Directory Layout

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 8 points
- **Created**: 2025-08-02
- **Type**: refactor
- **Character Impact**: All

## User Stories

### Primary User Story
As a developer working on the wedding app, I want an organized test structure that separates unit, integration, and e2e tests so that I can easily find, run, and maintain tests for different parts of the system.

### Secondary User Stories
- As a test-writer agent, I want clear directories for each test type so that I can generate tests in the appropriate location
- As a CI/CD system, I want structured test commands that run different test suites independently
- As a new developer, I want clear documentation about where different types of tests belong

## Technical Requirements

### Functional Requirements
1. Migrate existing mixed Python and TypeScript tests from `tests/` to organized structure
2. Update jest.config.js to reflect new frontend test paths
3. Update Makefile test commands to use new structure
4. Remove outdated `@tests/` references from CLAUDE.md
5. Update test-writer agent documentation with new directory structure
6. Create README files for each test directory explaining purpose and usage

### Non-Functional Requirements
1. Performance: Test discovery and execution should remain fast
2. Compatibility: All existing tests must continue to work after migration
3. Documentation: Clear guidelines for where new tests should be placed
4. Automation: Updated CI/CD workflows to use new structure

## Implementation Plan

### Phase 1: Directory Structure Creation and File Migration (3 points)

**Target Structure:**
```
tests/
├── unit/
│   ├── frontend/          # Jest tests for React components
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── backend/          # Python tests for Lambda/API
│       ├── handlers/
│       └── utils/
├── integration/
│   ├── frontend/         # React + API integration
│   └── backend/          # Lambda + DynamoDB integration
└── e2e/
    ├── playwright/       # Browser automation tests
    └── smoke/           # API smoke tests
```

**Files to Migrate:**
- `tests/test_auth_handler.py` → `tests/unit/backend/handlers/test_auth_handler.py`
- `tests/test_api_extractors.py` → `tests/unit/backend/utils/test_api_extractors.py`
- `tests/test_generate_dynamodb_schemas.py` → `tests/unit/backend/utils/test_generate_dynamodb_schemas.py`
- `tests/test_api_field_consistency.py` → `tests/integration/backend/test_api_field_consistency.py`
- `tests/e2e/test_auth_smoke.py` → `tests/e2e/smoke/test_auth_smoke.py`
- `tests/e2e/nav-visibility.spec.ts` → `tests/e2e/playwright/nav-visibility.spec.ts`

**Implementation steps:**
1. Create new directory structure with proper hierarchy
2. Move existing test files to appropriate new locations
3. Create `__init__.py` files in Python test directories for proper module discovery
4. Verify all file moves preserved test content and imports
5. Create placeholder README files for each directory

**Files to Create:**
- `tests/unit/README.md` - Unit testing guidelines
- `tests/unit/frontend/README.md` - Frontend unit test patterns
- `tests/unit/backend/README.md` - Backend unit test patterns
- `tests/integration/README.md` - Integration testing guidelines
- `tests/e2e/README.md` - End-to-end testing guidelines
- `tests/e2e/playwright/README.md` - Playwright testing patterns
- `tests/e2e/smoke/README.md` - Smoke testing guidelines

**Testing Requirements:**
1. Verify all migrated tests can still be discovered by their respective test runners
2. Ensure Python test imports still work after directory changes
3. Validate TypeScript test files compile and run
4. Check that test file references in documentation are updated

**Commit**: `refactor(test): migrate tests to organized directory structure`

### Phase 2: Configuration Updates (2 points)

**jest.config.js Updates:**
Update testMatch patterns to include new frontend test directories:
```javascript
testMatch: [
  '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
  '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  '<rootDir>/tests/unit/frontend/**/*.{test,spec}.{ts,tsx}',
  '<rootDir>/tests/integration/frontend/**/*.{test,spec}.{ts,tsx}',
  '<rootDir>/tests/e2e/playwright/**/*.{test,spec}.{ts,tsx}',
],
```

**Makefile Updates:**
Create specific test commands for each test type:
```makefile
# Unit Testing Commands
test-unit-python:
	@echo "Running Python unit tests..."
	cd tests/unit/backend && pytest . -v

test-unit-frontend:
	@echo "Running frontend unit tests..."
	npm test tests/unit/frontend

test-unit-all:
	@echo "Running all unit tests..."
	$(MAKE) test-unit-python
	$(MAKE) test-unit-frontend

# Integration Testing Commands  
test-integration-backend:
	@echo "Running backend integration tests..."
	cd tests/integration/backend && pytest . -v

test-integration-frontend:
	@echo "Running frontend integration tests..."
	npm test tests/integration/frontend

test-integration-all:
	@echo "Running all integration tests..."
	$(MAKE) test-integration-backend
	$(MAKE) test-integration-frontend

# E2E Testing Commands
test-e2e-smoke:
	@echo "Running smoke tests..."
	cd tests/e2e/smoke && pytest . -v

test-e2e-playwright:
	@echo "Running Playwright tests..."
	npx playwright test tests/e2e/playwright

test-e2e-all:
	@echo "Running all E2E tests..."
	$(MAKE) test-e2e-smoke
	$(MAKE) test-e2e-playwright

# Updated Legacy Commands
test-api-consistency: test-integration-backend
	@echo "API consistency tests completed"

test-all:
	@echo "Running complete test suite..."
	$(MAKE) test-unit-all
	$(MAKE) test-integration-all
	$(MAKE) test-e2e-all
```

**Implementation steps:**
1. Update jest.config.js with new test path patterns
2. Replace existing Makefile test commands with organized structure
3. Ensure legacy test commands (like test-api-consistency) still work
4. Test all new Makefile commands execute correctly
5. Update any pre-commit or pre-push hooks to use new test commands

**Files to Modify:**
- `jest.config.js` - Update testMatch patterns
- `Makefile` - Replace test commands with organized structure
- `.github/workflows/test.yml` (if exists) - Update CI test commands

**Testing Requirements:**
1. Verify `npm test` still runs all frontend tests
2. Ensure `make test-unit-python` discovers all Python unit tests
3. Test `make test-all` runs complete test suite
4. Validate legacy commands like `make test-api-consistency` work
5. Check CI/CD pipeline can use new test commands

**Commit**: `refactor(test): update test configurations for new directory structure`

### Phase 3: Documentation Updates and Agent Configuration (3 points)

**CLAUDE.md Updates:**
Remove all references to `@tests/` directory structure and update with new organization:
```markdown
**ALL tests MUST go in `tests/` with proper subdirectories:**
- `tests/unit/frontend/` - Jest tests for React components
- `tests/unit/backend/` - Python unit tests for Lambda functions
- `tests/integration/frontend/` - React + API integration tests
- `tests/integration/backend/` - Lambda + DynamoDB integration tests
- `tests/e2e/playwright/` - Browser automation tests
- `tests/e2e/smoke/` - API smoke tests

### Testing Workflow Examples:
```bash
# Frontend unit testing
npm test tests/unit/frontend

# Backend unit testing  
cd tests/unit/backend && pytest . -v

# Integration testing
make test-integration-all

# End-to-end testing
make test-e2e-all
```

**test-writer Agent Updates:**
Update agent documentation to reflect new directory structure:
```markdown
**Test File Locations by Type:**

### Unit Tests:
- **Frontend Components**: `tests/unit/frontend/components/test_[ComponentName].test.tsx`
- **Frontend Hooks**: `tests/unit/frontend/hooks/test_[hookName].test.ts`
- **Frontend Utils**: `tests/unit/frontend/utils/test_[utilName].test.ts`
- **Backend Handlers**: `tests/unit/backend/handlers/test_[handler_name].py`
- **Backend Utils**: `tests/unit/backend/utils/test_[util_name].py`

### Integration Tests:
- **Frontend Integration**: `tests/integration/frontend/test_[feature]_integration.test.tsx`
- **Backend Integration**: `tests/integration/backend/test_[feature]_integration.py`

### E2E Tests:
- **Playwright Tests**: `tests/e2e/playwright/[feature].spec.ts`
- **Smoke Tests**: `tests/e2e/smoke/test_[feature]_smoke.py`

**Mandatory E2E Smoke Tests for AWS integrations**: Always create in `tests/e2e/smoke/`
```

**README File Content:**
Create comprehensive README files for each test directory:

`tests/unit/README.md`:
```markdown
# Unit Tests

Unit tests verify individual components, functions, or modules in isolation.

## Structure
- `frontend/` - Jest tests for React components, hooks, and utilities
- `backend/` - Python pytest tests for Lambda handlers and utilities

## Running Tests
```bash
# All unit tests
make test-unit-all

# Frontend only
make test-unit-frontend

# Backend only  
make test-unit-python
```

## Guidelines
- Test one component/function per file
- Mock external dependencies
- Use descriptive test names
- Focus on public interfaces
```

**Implementation steps:**
1. Update CLAUDE.md to remove `@tests/` references and add new structure
2. Update test-writer agent documentation with new directory conventions
3. Create comprehensive README files for each test directory
4. Add examples and guidelines for each test type
5. Update any references in other documentation files

**Files to Modify:**
- `CLAUDE.md` - Remove `@tests/` references, add new structure
- `.claude/agents/test-writer.md` - Update with new directory structure
- `docs/generate_ticket_rules.md` - Update test-related sections if needed

**Files to Create:**
- `tests/unit/README.md` - Unit testing overview and guidelines
- `tests/unit/frontend/README.md` - Frontend unit testing patterns
- `tests/unit/backend/README.md` - Backend unit testing patterns
- `tests/integration/README.md` - Integration testing guidelines
- `tests/integration/frontend/README.md` - Frontend integration patterns
- `tests/integration/backend/README.md` - Backend integration patterns
- `tests/e2e/README.md` - E2E testing overview
- `tests/e2e/playwright/README.md` - Playwright testing guidelines
- `tests/e2e/smoke/README.md` - Smoke testing guidelines

**Testing Requirements:**
1. Verify all documentation examples work correctly
2. Test that test-writer agent can use new directory structure
3. Ensure README files provide clear guidance for each test type
4. Validate documentation links and references are accurate
5. Test character system integration examples in E2E documentation

**Commit**: `docs(test): update documentation for new test structure`

## Testing Strategy

### Migration Verification Tests
- All existing tests continue to pass after migration
- Test discovery works correctly in new directory structure
- All test runners (jest, pytest, playwright) find tests in new locations
- Makefile commands execute tests from correct directories

### Configuration Validation Tests
- `npm test` runs all frontend tests (unit + integration)
- `make test-unit-python` runs only Python unit tests
- `make test-integration-all` runs all integration tests
- `make test-e2e-all` runs all end-to-end tests
- Legacy commands like `test-api-consistency` still work

### Documentation Accuracy Tests
- All README files provide accurate commands and examples
- CLAUDE.md references are updated and correct
- test-writer agent can follow new directory conventions
- Examples in documentation actually work when executed

### Character Perspective Tests
- Test documentation includes character system testing guidelines
- E2E test examples cover all three character perspectives
- Integration test patterns account for character context switching

## Documentation Updates Required

### Core Documentation
- `CLAUDE.md` - Remove `@tests/` references, add new test structure
- `docs/generate_ticket_rules.md` - Update test-related sections if needed
- `README.md` - Update testing section if it references old structure

### Technical Documentation
- `.claude/agents/test-writer.md` - Update directory structure and examples
- README files for each test directory with guidelines and examples
- Update any existing test documentation in `docs/` directory

### User Documentation
- Clear guidelines on where to place new tests
- Examples of running different test types
- Integration with existing development workflow

## Success Criteria

### Functional Acceptance Criteria
- All existing tests pass after migration to new directory structure
- Test discovery works correctly for all test types (unit, integration, e2e)
- Makefile provides specific commands for each test category
- Documentation clearly explains where different test types belong
- test-writer agent can generate tests in appropriate directories

### Performance Criteria
- Test execution time does not increase after restructuring
- Test discovery remains fast across all directories
- CI/CD pipeline runs efficiently with new test structure

### Quality Criteria
- All tests maintain same coverage levels after migration
- New directory structure follows industry best practices
- Documentation is comprehensive and beginner-friendly
- Configuration files are clean and maintainable
- Migration preserves all existing test functionality

## Dependencies

### Technical Dependencies
- jest.config.js configuration changes
- Makefile test command updates
- Python package discovery in new directory structure
- TypeScript compilation for moved test files

### Character System Dependencies
- E2E test documentation includes character switching tests
- Integration test guidelines cover character context persistence
- Smoke test examples include character-specific API interactions

### Development Dependencies
- All existing tests must pass before migration completion
- CI/CD workflow updates to use new test commands
- Developer documentation updates for new workflow

## Risks & Mitigations

### Technical Risks
**Risk**: Tests fail to run after directory migration due to import path issues
**Impact**: HIGH
**Mitigation**: Thoroughly test all imports and add `__init__.py` files for Python packages

**Risk**: Jest configuration fails to discover tests in new locations
**Impact**: MEDIUM
**Mitigation**: Update testMatch patterns incrementally and verify with `--listTests` flag

**Risk**: Makefile test commands break existing CI/CD workflows
**Impact**: HIGH
**Mitigation**: Maintain backward compatibility with legacy test commands

### Developer Experience Risks
**Risk**: Confusion about where to place new tests
**Impact**: MEDIUM
**Mitigation**: Create comprehensive README files and update agent documentation

**Risk**: Increased complexity in test execution
**Impact**: LOW
**Mitigation**: Provide simple `make test-all` command for complete test suite

### Documentation Risks
**Risk**: Outdated references in CLAUDE.md causing agent confusion
**Impact**: MEDIUM
**Mitigation**: Systematic review and update of all documentation references

**Risk**: test-writer agent generates tests in wrong locations
**Impact**: LOW
**Mitigation**: Update agent documentation with clear examples and directory conventions