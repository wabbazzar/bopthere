# Ticket 016: Integrated Games Tab Top 5 Leaderboard Display

## Metadata
- **Status**: Not Started
- **Priority**: Medium
- **Effort**: 8 points
- **Created**: 2025-08-10
- **Type**: feature
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding guest, I want to see the top 5 scores for all games displayed prominently in the games tab so that I can quickly see high scores without needing to open a separate leaderboard dialog.

### Secondary User Stories
- As a wedding guest, I want to see top 5 scores for each game listed sequentially as new games are added so that I can compare performance across different games
- As a wedding guest, I want the leaderboard to refresh automatically when I navigate to the games tab so that I always see current standings
- As a wedding guest, I want to see subtle visual feedback when a new high score is achieved so that I know my accomplishment is recognized
- As Wesley/Heather, I want guests to have immediate access to competitive standings that enhance the Epic Wedding Quest experience

## Technical Requirements

### Functional Requirements
1. Display top 5 scores at the top of the games tab view (not as a separate button/dialog)
2. Show all games' top 5 scores sequentially as new games are added to the system
3. If fewer than 5 scores exist for a game, display all available scores
4. Auto-refresh leaderboard data when user navigates to games tab and when app loads
5. Background loading of leaderboard data as soon as the app loads (not wait for games tab click)
6. Must work across all three character perspectives (Wesley, Heather, Puffy)
7. Mobile-first responsive design optimized for wedding guest devices

### Non-Functional Requirements
1. Performance: Initial leaderboard load < 2 seconds on mobile
2. Accessibility: WCAG 2.1 AA compliance for leaderboard display
3. Character Theming: Maintain character-specific colors, fonts, and content variations
4. Visual Feedback: Subtle highlight/animation for new high scores
5. Error Handling: Simple error message with retry option

## Implementation Plan

### Phase 1: Games Tab Leaderboard Container Component (3 points)
**Files to modify:**
- `src/components/festival/GamesView.tsx` - Add integrated leaderboard display at top
- `src/types/leaderboard.ts` - Add multi-game leaderboard interfaces

**Component Structure:**
```typescript
interface GamesTabLeaderboardProps {
  character: Character;
  className?: string;
}

interface MultiGameLeaderboard {
  [gameName: string]: {
    game: string;
    scores: LeaderboardScore[];
    total_players: number;
  };
}

export function GamesTabLeaderboard({ character, className }: GamesTabLeaderboardProps) {
  const [leaderboards, setLeaderboards] = useState<MultiGameLeaderboard>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Implementation following existing patterns in src/components/leaderboard/LeaderboardDisplay.tsx
}
```

**Integration with existing GamesView:**
- Add leaderboard container at the top of GamesView after header card
- Remove existing "Tournament Leaderboard" card from grid
- Maintain existing Tetris and coming soon game cards
- Follow existing card-based layout patterns with backdrop blur

**Implementation steps:**
1. Create GamesTabLeaderboard component using existing LeaderboardDisplay patterns
2. Add multi-game data fetching with top 5 limit per game
3. Integrate component into GamesView.tsx layout at top position
4. Remove separate leaderboard dialog and card from existing implementation
5. Ensure character theme integration with existing characterThemes patterns

**Testing:**
1. Run: `claude "Use the test-writer agent to write tests for src/components/festival/GamesView.tsx focusing on leaderboard integration"`
2. Run: `claude "Use the test-critic agent to review tests for src/components/festival/GamesView.tsx for character theme coverage"`
3. Run: `claude "Use the test-writer agent to implement critic's suggestions for GamesView tests"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Use specialized agents:**
```bash
# Have the code-writer agent implement the leaderboard container
claude "Use the code-writer agent to implement GamesTabLeaderboard component in src/components/festival/GamesView.tsx following Phase 1 specifications"

# Have the code-quality-assessor review the implementation
claude "Use the code-quality-assessor agent to review src/components/festival/GamesView.tsx for React best practices and performance"
```

**Commit**: `feat(games): add integrated top 5 leaderboard display to games tab`

### Phase 2: Multi-Game Leaderboard API Integration (3 points)
**Files to modify:**
- `src/utils/leaderboardApi.ts` - Add multi-game fetching functions
- `src/types/leaderboard.ts` - Add interfaces for multi-game responses

**API Integration Structure:**
```typescript
// New functions in leaderboardApi.ts
export async function fetchAllGamesLeaderboard(limit: number = 5): Promise<MultiGameLeaderboard> {
  // Fetch leaderboards for all supported games
  // Currently: tetris
  // Future: expanding as new games are added
}

export async function fetchGameLeaderboard(game: string, limit: number = 5): Promise<LeaderboardResponse> {
  // Modified version of existing fetchLeaderboard with limit parameter
}
```

**Background Loading Implementation:**
- Add leaderboard data prefetching in App.tsx or CharacterContext initialization
- Cache leaderboard data in React state/context for quick access
- Implement smart refresh logic on games tab navigation
- Use existing patterns from src/utils/leaderboardApi.ts for error handling

**Implementation steps:**
1. Extend existing leaderboardApi.ts with multi-game support and limit parameters
2. Modify existing fetchLeaderboard function to accept limit parameter (default 10 for backward compatibility)
3. Add fetchAllGamesLeaderboard function to get top 5 for all games
4. Implement background loading in app initialization
5. Add refresh logic for games tab navigation

**Testing:**
1. Run: `claude "Use the test-writer agent to create E2E smoke tests for multi-game leaderboard API that verify top 5 score limiting"`
2. Test API integration with existing /leaderboard/{game} endpoints
3. Verify background loading doesn't impact app startup performance

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Use specialized agents:**
```bash
# Have the code-writer agent implement API integration
claude "Use the code-writer agent to implement multi-game leaderboard API functions in src/utils/leaderboardApi.ts following Phase 2 specifications"

# Have the test-writer agent create comprehensive API tests
claude "Use the test-writer agent to create E2E smoke tests for multi-game leaderboard endpoints verifying Gateway → Lambda → DynamoDB flow"
```

**Commit**: `feat(leaderboard): implement multi-game API integration with top 5 limiting`

### Phase 3: Visual Feedback and Error Handling (2 points)
**Files to modify:**
- `src/components/festival/GamesView.tsx` - Add visual feedback and error states
- `src/components/festival/TetrisPage.tsx` - Add new high score feedback integration

**Visual Feedback Implementation:**
```typescript
// New high score feedback
interface NewHighScoreNotification {
  show: boolean;
  message: string;
  rank: number;
}

// Subtle highlight animation for new scores
const NewScoreHighlight = ({ isNew, children }: { isNew: boolean; children: React.ReactNode }) => (
  <motion.div
    initial={isNew ? { backgroundColor: 'rgba(34, 197, 94, 0.1)' } : {}}
    animate={isNew ? { backgroundColor: 'rgba(34, 197, 94, 0.05)' } : {}}
    transition={{ duration: 2 }}
    className={cn('transition-colors', isNew && 'ring-1 ring-green-200')}
  >
    {children}
  </motion.div>
);
```

**Error Handling with Retry:**
- Simple error message following existing toast notification patterns
- Retry button using existing Button component styling
- Loading states with skeleton loaders from existing patterns
- Graceful degradation when leaderboard service unavailable

**Implementation steps:**
1. Add loading skeleton states using existing Skeleton component patterns
2. Implement error states with retry functionality
3. Add subtle highlighting for new high scores using Framer Motion
4. Integrate new score notifications with existing toast system
5. Test error scenarios and network failures

**Testing:**
1. Test loading states and skeleton animations
2. Test error scenarios and retry functionality
3. Test new high score visual feedback
4. Verify error handling doesn't break existing game functionality

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Use specialized agents:**
```bash
# Have the code-writer agent implement visual feedback
claude "Use the code-writer agent to implement visual feedback and error handling in src/components/festival/GamesView.tsx following Phase 3 specifications"

# Have the code-quality-assessor review visual feedback implementation
claude "Use the code-quality-assessor agent to review visual feedback implementation for accessibility and performance"
```

**Commit**: `feat(games): add visual feedback and error handling for leaderboard display`

## Testing Strategy

### Character Perspective Tests
- Test leaderboard display as Wesley (adventure theme with "Epic Quest Rankings")
- Test leaderboard display as Heather (elegant theme with "Elegant Competition Board")
- Test leaderboard display as Puffy (playful theme with "Super Fun High Scores!")
- Verify character-specific content variations and color schemes
- Test smooth character switching while viewing leaderboards

### Responsive Design Tests
- Mobile: iPhone/Android (375px - 768px) - Primary focus for wedding guests
- Tablet: iPad (768px - 1024px) - Secondary device testing
- Desktop: (1024px+) - Full layout verification
- Test touch interactions for mobile scrolling
- Verify leaderboard readability on small screens

### Integration Tests
- Games tab navigation and leaderboard refresh
- Background loading performance on app startup
- Multi-game leaderboard data integration
- Error recovery and retry functionality
- New high score visual feedback triggering

### E2E Smoke Tests
**MANDATORY**: Each phase must include smoke tests that verify the complete Gateway → Lambda → Table flow

**Test Structure**:
```bash
# Create test file: tests/e2e/smoke/test_games_tab_leaderboard_smoke.py
import os
import requests
import pytest

ENV = os.environ.get('ENV', 'prod')
API_BASE = f"https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/{ENV}"

def test_multi_game_leaderboard_display():
    """Smoke test for games tab leaderboard - verifies multi-game top 5 display"""
    
    # 1. Test tetris leaderboard endpoint (currently only supported game)
    response = requests.get(f"{API_BASE}/leaderboard/tetris")
    assert response.status_code == 200
    data = response.json()
    assert data["game"] == "tetris"
    assert "scores" in data
    assert len(data["scores"]) <= 5  # Should limit to top 5 for games tab
    
    # 2. Verify score structure matches frontend expectations
    if data["scores"]:
        score = data["scores"][0]
        assert "username" in score
        assert "score" in score
        assert "timestamp" in score
        assert "character" in score
    
    # 3. Test error handling for non-existent games
    error_response = requests.get(f"{API_BASE}/leaderboard/nonexistent")
    # Should return empty scores or appropriate error, not crash

def test_background_loading_performance():
    """Test that background loading doesn't impact startup performance"""
    import time
    start_time = time.time()
    
    response = requests.get(f"{API_BASE}/leaderboard/tetris")
    
    load_time = time.time() - start_time
    assert load_time < 2.0, f"Leaderboard load time {load_time}s exceeds 2s requirement"
    assert response.status_code == 200

# Run with: pytest tests/e2e/smoke/test_games_tab_leaderboard_smoke.py -v
```

**Integration with test-writer agent**:
```bash
# Have test-writer create E2E smoke tests
claude "Use the test-writer agent to create E2E smoke tests for games tab leaderboard that verify top 5 limiting and multi-game support"
```

## Documentation Updates Required
1. Update GamesView component documentation for integrated leaderboard
2. Document multi-game leaderboard API patterns
3. Add visual feedback and error handling documentation

## Success Criteria
1. Top 5 scores display prominently at top of games tab for all games
2. Leaderboard refreshes automatically on tab navigation and app load
3. Background loading completes without impacting app startup performance
4. Visual feedback provides subtle confirmation of new high scores
5. Error handling provides clear retry options with user-friendly messages
6. Mobile-first design works seamlessly on wedding guest devices
7. Character theming maintained across all three perspectives

## Dependencies
- Existing leaderboard API endpoints (/leaderboard/{game})
- Character context system for theming
- Existing LeaderboardDisplay component patterns
- Framer Motion for visual feedback animations
- shadcn/ui components for consistent UI elements

## Risks & Mitigations
1. **Risk**: Background loading impacting app startup performance
   **Mitigation**: Implement lazy loading and performance testing, cache results efficiently
2. **Risk**: Multi-game scaling as new games are added
   **Mitigation**: Design flexible API structure, use Promise.all for parallel fetching
3. **Risk**: Mobile performance with frequent refreshes
   **Mitigation**: Implement smart refresh logic, cache responses, optimize API calls

## Deployment Guide

**CRITICAL**: This section MUST be updated by EVERY agent working on the ticket when making infrastructure changes.

### Infrastructure Changes

#### Frontend Changes Only
- **Components**: Updates to existing React components only
- **API Integration**: Uses existing leaderboard API endpoints
- **No new AWS resources required**

#### Environment Variables
- No new environment variables required
- Uses existing `VITE_API_URL` for API communication

### Deployment Steps

1. **Frontend Deployment**:
   ```bash
   # Build and test locally
   npm run build
   npm run test
   
   # Deploy to GitHub Pages
   npm run deploy
   ```

2. **No Backend Changes**: This feature uses existing leaderboard API infrastructure

### Deployment Verification

**Automated Smoke Tests**:
```bash
# Run E2E smoke tests after deployment
pytest tests/e2e/smoke/test_games_tab_leaderboard_smoke.py -v --env=prod

# Verify games tab functionality
make test-games-tab-leaderboard
```

**Manual Verification Commands**:
```bash
# Test API endpoints still working
curl -X GET https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod/leaderboard/tetris

# Verify frontend can access API
# Open browser developer tools on https://heatherandwesley.com/festival
# Navigate to games tab and check network requests
```

### Rollback Plan
1. **Frontend**: Revert GitHub Pages deployment
   ```bash
   git revert [commit-hash]
   git push origin main
   ```

2. **Component Fallback**: Existing leaderboard dialog still functional as fallback

### Production Readiness Checklist
- [ ] All E2E smoke tests passing for games tab integration
- [ ] Background loading performance meets <2s requirement
- [ ] Character-specific features tested (Wesley/Heather/Puffy)
- [ ] Mobile responsiveness verified on actual devices
- [ ] Error handling tested with network failures
- [ ] Visual feedback animations working smoothly
- [ ] Games tab navigation and refresh working correctly
- [ ] Existing Tetris game functionality unchanged