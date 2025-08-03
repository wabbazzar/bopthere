# Leaderboard Navigation Debug Test

This directory contains a comprehensive Playwright test to debug the leaderboard navigation issue where the LeaderboardDisplay component throws an error about undefined `theme.fonts`.

## Issue Description

**Error**: `Uncaught TypeError: Cannot read properties of undefined (reading 'fonts')`
**Location**: `LeaderboardDisplay.tsx:100:84`
**Trigger**: Clicking the Tournament Leaderboard card from the games dashboard

## Root Cause Analysis

The issue is in the theme structure mismatch:

1. **LeaderboardDisplay component** (line 26, 100, 142, 149) expects:
   ```typescript
   const { character, theme } = useCharacter();
   // Uses: theme.fonts.heading, theme.fonts.body
   ```

2. **CharacterContext** only provides:
   ```typescript
   {
     selectedCharacter: Character | null;
     setSelectedCharacter: (character: Character) => void;
   }
   ```

3. **Missing**: The `theme` property with `fonts` structure

## Test Features

The `test-leaderboard-navigation.spec.ts` test provides:

### 1. Navigation Flow Testing
- Character selection verification
- Games dashboard navigation
- Leaderboard dialog opening

### 2. Theme Structure Debugging
- Character context analysis
- Theme structure validation
- Missing properties identification

### 3. API Integration Testing
- DynamoDB test data setup
- Leaderboard API endpoint verification
- Score submission testing
- Complete data flow validation

### 4. Error Diagnosis
- Console error capture
- Component state analysis
- Theme access debugging

### 5. Fix Simulation
- Mock theme structure injection
- Fix validation testing
- Expected behavior verification

## Running the Tests

### Prerequisites

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Ensure API is accessible**:
   ```bash
   # Test the leaderboard endpoint
   curl https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod/leaderboard/tetris
   ```

### Run the Debug Test

```bash
# Run the complete debug test suite
npx playwright test test-leaderboard-navigation.spec.ts --headed

# Run specific test scenarios
npx playwright test test-leaderboard-navigation.spec.ts --grep "debug leaderboard navigation" --headed

# Run theme verification only  
npx playwright test test-leaderboard-navigation.spec.ts --grep "verify theme structure" --headed

# Run fix simulation
npx playwright test test-leaderboard-navigation.spec.ts --grep "simulate fix" --headed
```

### Debug Output

The test generates:
- **Screenshots**: `debug/1-initial-state.png` through `debug/7-final-state.png`
- **Console logs**: Detailed debugging information in terminal
- **Debug data**: Stored in browser sessionStorage

## Expected Test Results

### Current State (Before Fix)
- ✅ Navigation to games dashboard works
- ✅ API endpoints are accessible  
- ❌ Leaderboard dialog fails to render properly
- ❌ Console error: "Cannot read properties of undefined (reading 'fonts')"

### After Fix Implementation
- ✅ All navigation works
- ✅ Leaderboard dialog renders properly
- ✅ Theme fonts are accessible
- ✅ No console errors

## Recommended Fixes

### Option 1: Extend CharacterContext (Recommended)

```typescript
// In CharacterContext.tsx
interface CharacterContextType {
  selectedCharacter: Character | null;
  setSelectedCharacter: (character: Character) => void;
  theme: CharacterTheme & { fonts: { heading: string; body: string } }; // Add theme
}
```

### Option 2: Modify LeaderboardDisplay

```typescript
// In LeaderboardDisplay.tsx  
export function LeaderboardDisplay({ character, ...props }: LeaderboardDisplayProps) {
  // Derive theme from character prop instead of useCharacter hook
  const theme = useMemo(() => ({
    ...characterThemes[character],
    fonts: {
      heading: 'Cinzel, serif',
      body: 'Crimson Text, serif'  
    }
  }), [character]);
}
```

### Option 3: Create Enhanced useCharacter Hook

```typescript
// Create useCharacterTheme hook
export const useCharacterTheme = () => {
  const { selectedCharacter } = useCharacter();
  return useMemo(() => ({
    character: selectedCharacter,
    theme: selectedCharacter ? {
      ...characterThemes[selectedCharacter],
      fonts: {
        heading: 'Cinzel, serif',
        body: 'Crimson Text, serif'
      }
    } : null
  }), [selectedCharacter]);
};
```

## Integration with CI/CD

Add to GitHub Actions:

```yaml
- name: Run Leaderboard Debug Tests
  run: npx playwright test test-leaderboard-navigation.spec.ts

- name: Upload Debug Screenshots  
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: leaderboard-debug-screenshots
    path: debug/
```

## Debugging Tips

1. **Enable navigation debug mode**: Add `?nav-debug` to URL
2. **Check console logs**: Test captures all browser console output
3. **Review screenshots**: Visual debugging through captured images
4. **Verify API responses**: Test includes direct API endpoint testing
5. **Check character selection**: Ensure character is properly selected before navigation

## Next Steps

1. Run the debug test to confirm the issue
2. Implement one of the recommended fixes
3. Re-run the test to verify the fix
4. Add the fix to the main codebase
5. Update the CharacterContext or component as needed

The test provides comprehensive debugging to identify the exact cause and validate the fix implementation.