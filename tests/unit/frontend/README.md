# Frontend Unit Tests

This directory contains unit tests for React components, hooks, and utilities.

## Structure

- `components/` - Tests for React components
- `hooks/` - Tests for custom React hooks
- `utils/` - Tests for utility functions

## Running Tests

```bash
# Run all frontend unit tests
make test-unit-frontend

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Writing Tests

### Component Tests
```typescript
import { render, screen } from '@testing-library/react';
import { CharacterProvider } from '@/contexts/CharacterContext';
import MyComponent from '@/components/MyComponent';

test('renders with character theme', () => {
  render(
    <CharacterProvider>
      <MyComponent />
    </CharacterProvider>
  );
  
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Best Practices
- Test all three character perspectives (Wesley, Heather, Puffy)
- Test responsive behavior for mobile/tablet/desktop
- Mock external dependencies (Supabase, API calls)
- Focus on user interactions and accessibility