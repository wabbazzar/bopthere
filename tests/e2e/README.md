# End-to-End Tests

This directory contains tests that verify complete user flows and system behavior.

## Structure

- `playwright/` - Browser automation tests for UI flows
- `smoke/` - Quick API smoke tests to verify deployments

## Playwright Tests

Full browser automation tests that simulate real user interactions:
- Character selection and theme switching
- RSVP form submission flow
- Navigation and responsiveness
- Cross-browser compatibility

### Running Playwright Tests
```bash
# Run all Playwright tests
make test-e2e-playwright

# Run with UI mode
npx playwright test --ui

# Run specific test
npx playwright test tests/e2e/playwright/nav-visibility.spec.ts
```

## Smoke Tests

Quick tests to verify API endpoints are functioning:
- Authentication endpoints
- RSVP submission
- Data retrieval

### Running Smoke Tests
```bash
# Run all smoke tests
make test-e2e-smoke

# Run specific smoke test
cd tests/e2e/smoke && pytest test_auth_smoke.py -v
```

## Best Practices
- Test complete user journeys
- Include mobile viewport testing
- Capture screenshots on failure
- Keep smoke tests fast and focused