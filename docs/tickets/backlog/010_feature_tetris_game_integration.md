# Ticket 010: Tetris Game Integration into Wedding App Games Tab

## Metadata
- **Status**: Not Started
- **Priority**: Medium
- **Effort**: 8 points
- **Created**: 2025-08-02
- **Type**: feature
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding guest, I want to play the Tetris game in the games tab so that I can enjoy classic gameplay entertainment during the wedding festivities.

### Secondary User Stories
- As Wesley, I want to experience the Tetris game as a heroic quest challenge to prove my gaming prowess
- As Heather, I want to enjoy the elegant puzzle gameplay as a refined entertainment option
- As Puffy, I want to have fun with the colorful Tetris blocks and celebrate high scores with excitement

## Technical Requirements

### Functional Requirements
1. Embed the existing vanilla JavaScript Tetris game from ../tetris/index.html into the wedding app
2. Replace the "Coming Soon" placeholder in GamesView.tsx with the actual Tetris game
3. Use iframe embedding to maintain game independence and preserve existing functionality
4. Add character-specific introductions and theming around the game iframe
5. Ensure the game works seamlessly on both mobile and desktop within the wedding app context
6. Implement proper iframe security measures and sandbox attributes
7. Add loading states and error handling for the iframe content
8. Preserve the game's PWA features and mobile optimization when embedded

### Non-Functional Requirements
1. Performance: Game loads within 3 seconds on mobile devices
2. Accessibility: Iframe has proper ARIA labels and keyboard navigation support
3. Character Theming: Game container matches character-specific colors and styling
4. Security: Iframe uses proper sandbox attributes to prevent security vulnerabilities
5. Responsive Design: Game iframe scales appropriately across all viewport sizes

## Implementation Plan

### Phase 1: Game Container Setup (3 points)
**Files to modify:**
- `src/components/festival/GamesView.tsx` - Replace coming soon content with game container
- `public/games/` - Create directory for game assets (if needed)

**Component Structure:**
```typescript
interface TetrisGameProps {
  character: Character;
  theme: CharacterTheme;
}

export function TetrisGame({ character, theme }: TetrisGameProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Handle iframe load events
  // Character-specific styling
  // Error handling and fallbacks
}
```

**Character-specific Game Introductions:**
```typescript
const gameIntroductions = {
  wesley: {
    title: "Epic Tetris Quest",
    subtitle: "Master the falling blocks, brave adventurer!",
    description: "Channel your strategic mind and lightning reflexes in this legendary puzzle challenge. Stack the mystical blocks with precision and clear lines to achieve victory in the ancient game of Tetris!"
  },
  heather: {
    title: "Elegant Tetris Puzzle",
    subtitle: "A timeless classic for refined entertainment",
    description: "Enjoy this beautifully crafted puzzle experience. Arrange the graceful falling pieces with care and create perfect lines in this sophisticated and relaxing gameplay."
  },
  puffy: {
    title: "Super Fun Tetris Party!",
    subtitle: "The most exciting block-stacking adventure ever!",
    description: "Get ready for the most amazing Tetris experience! Watch the colorful blocks fall and create awesome line clears. This game is absolutely perfect for our epic party weekend!"
  }
};
```

**Implementation steps:**
1. Create TetrisGame component with character theming
2. Add iframe container with proper security attributes
3. Implement loading states with character-themed spinners
4. Add error handling with graceful fallbacks
5. Style container borders and backgrounds using character themes

**Testing:**
1. Run: `claude --agent test-writer "Write tests for src/components/festival/TetrisGame.tsx"`
2. Run: `claude --agent test-critic "Review tests for src/components/festival/TetrisGame.tsx"`
3. Run: `claude --agent test-writer "Implement critic's suggestions for src/components/festival/TetrisGame.tsx"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(games): add tetris game container component`

### Phase 2: Iframe Integration and Security (3 points)
**Files to modify:**
- `src/components/festival/TetrisGame.tsx` - Implement iframe with security measures
- `public/` - Copy or link Tetris game files appropriately

**Iframe Security Configuration:**
```typescript
const iframeAttributes = {
  src: "/tetris/index.html", // Adjust path as needed
  sandbox: "allow-scripts allow-same-origin allow-forms",
  allow: "accelerometer; gyroscope; vibrate",
  loading: "lazy",
  title: `Tetris Game - ${characterNames[character]} Theme`,
  "aria-label": `Tetris game embedded for ${characterNames[character]}`,
};
```

**Game Asset Handling:**
- Determine if Tetris game should be copied to public/ or accessed via relative path
- Ensure all game assets (CSS, JS, manifest) are accessible
- Verify PWA features work within iframe context
- Test game controls and mobile interactions

**Puffy Smile Animation Implementation:**
```typescript
// Animation component for multi-row clears
const PuffySmileAnimation: React.FC<{ rowsCleared: number }> = ({ rowsCleared }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  // Scale and duration based on rows cleared
  const scale = rowsCleared === 2 ? 0.8 : rowsCleared === 3 ? 1 : 1.2;
  const duration = rowsCleared === 2 ? 1500 : rowsCleared === 3 ? 2000 : 2500;
  
  // Random position around edges
  const positions = [
    { top: '10%', left: '10%' },
    { top: '10%', right: '10%' },
    { bottom: '10%', left: '10%' },
    { bottom: '10%', right: '10%' },
  ];
  const position = positions[Math.floor(Math.random() * positions.length)];
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);
  
  return (
    <img
      src="/app-uploads/puffysmile.png"
      alt="Puffy celebrating your achievement!"
      className={`fixed z-50 transition-all ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        ...position,
        transform: `scale(${scale})`,
        transition: `opacity 300ms ease-in-out`,
      }}
    />
  );
};

// Message listener for Tetris game events
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'TETRIS_ROWS_CLEARED' && event.data.rows >= 2) {
      setShowPuffySmile({ show: true, rows: event.data.rows });
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

**Implementation steps:**
1. Configure iframe with proper sandbox and security attributes
2. Set up game asset accessibility (copy files or configure paths)
3. Implement iframe communication if needed for theme integration
4. Add responsive iframe sizing that maintains game aspect ratio
5. Test all game functionality within iframe context
6. Modify Tetris game to post message when rows are cleared:
   ```javascript
   // Add to Tetris game's row clearing logic
   if (parent !== window) {
     parent.postMessage({
       type: 'TETRIS_ROWS_CLEARED',
       rows: rowsCleared // 2, 3, or 4
     }, '*');
   }
   ```

**Testing:**
1. Test game loads correctly in iframe across all character themes
2. Verify mobile touch controls work within iframe
3. Test game performance and responsiveness
4. Validate security attributes prevent unauthorized access

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(games): implement secure tetris iframe integration`

### Phase 3: Character Theme Integration and Polish (2 points)
**Files to modify:**
- `src/components/festival/TetrisGame.tsx` - Add character-specific styling and polish
- `src/components/festival/GamesView.tsx` - Update to use new TetrisGame component

**Character Theme Styling:**
```typescript
const getThemeStyles = (theme: CharacterTheme) => ({
  container: {
    borderColor: theme.primary,
    backgroundColor: `${theme.primary}10`,
    boxShadow: `0 0 20px ${theme.primary}30`,
  },
  header: {
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
    color: '#ffffff',
  },
  iframe: {
    border: `3px solid ${theme.primary}`,
    borderRadius: '12px',
  }
});
```

**Polish Features:**
- Add character-specific game instructions overlay
- Implement fullscreen toggle button (mobile-friendly)
- Add game controls reference card matching character theme
- Create loading animation with character colors
- Add sound toggle if game audio is available
- **Puffy Smile Animation**: When players clear 2, 3, or 4 rows (including Tetris), display the puffysmile.png image as a celebratory overlay animation

**Implementation steps:**
1. Replace Coming Soon card in GamesView.tsx with TetrisGame component
2. Add character-themed styling to game container
3. Implement fullscreen functionality for mobile users
4. Add helpful UI elements (instructions, controls reference)
5. Polish loading states and error handling with character themes
6. Implement Puffy smile animation system:
   - Listen for message events from Tetris iframe for row clear notifications
   - When 2+ rows cleared, overlay puffysmile.png with fade-in/fade-out animation
   - Scale animation intensity based on rows cleared (2 rows = small, 3 rows = medium, 4 rows/Tetris = large)
   - Position image randomly around screen edges to not obstruct gameplay
   - Animation duration: 2 rows = 1.5s, 3 rows = 2s, 4 rows = 2.5s

**Testing:**
1. Test complete integration in all three character perspectives
2. Verify responsive design on mobile, tablet, desktop
3. Test fullscreen functionality on mobile devices
4. Validate graceful error handling with themed error messages
5. Test Puffy smile animation:
   - Verify animation triggers for 2, 3, and 4 row clears
   - Test different scale sizes (small, medium, large) display correctly
   - Confirm animation doesn't obstruct gameplay
   - Validate animation timing and fade effects
   - Test message passing between iframe and parent window

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(games): complete tetris integration with character themes`

## Testing Strategy

### Character Perspective Tests
- Test Tetris game loads and plays correctly as Wesley (adventure theme)
- Test Tetris game loads and plays correctly as Heather (elegant theme)
- Test Tetris game loads and plays correctly as Puffy (playful theme)
- Verify character-specific introductions and styling appear correctly
- Test smooth transitions when switching between characters

### Iframe Security Tests
- Verify sandbox attributes prevent unauthorized script execution
- Test that game cannot access parent window or sensitive data
- Validate proper CORS handling for game assets
- Ensure iframe cannot perform unauthorized navigation

### Mobile and Touch Tests
- Test touch controls work correctly within iframe on mobile
- Verify game scales properly on different mobile screen sizes
- Test fullscreen functionality on mobile browsers
- Validate touch gestures (swipe, tap, long press) work as expected

### Performance Tests
- Measure iframe loading time across different connection speeds
- Test game performance within iframe vs standalone
- Verify memory usage remains reasonable during extended gameplay
- Test concurrent usage (multiple guests playing simultaneously)

### Integration Tests
- Test navigation to/from games tab doesn't break game state
- Verify character switching while game is loaded works correctly
- Test game continues properly after app state changes
- Validate proper cleanup when navigating away from games

### Browser Compatibility Tests
- Test iframe functionality across Chrome, Safari, Firefox, Edge
- Verify mobile browser compatibility (iOS Safari, Android Chrome)
- Test PWA features work within embedded context
- Validate game controls work with keyboard and touch across browsers

## Documentation Updates Required
1. Update GamesView component documentation with Tetris integration details
2. Document iframe security considerations and implementation
3. Add troubleshooting guide for common iframe/embedding issues
4. Document character theming approach for future game integrations

## Success Criteria
1. Tetris game loads and plays correctly within wedding app across all character themes
2. Mobile touch controls work seamlessly within embedded game
3. Game maintains original functionality and performance when embedded
4. Character-specific theming and introductions enhance the wedding app experience
5. Iframe implementation follows security best practices
6. Page performance remains under 3 seconds load time on mobile
7. Game integration feels seamless and matches wedding app design language

## Dependencies
- Existing Tetris game files at ../tetris/index.html
- Character context system from src/contexts/CharacterContext.tsx
- Character theme definitions from src/types/character.ts
- shadcn/ui components for consistent styling
- Wedding app's responsive design patterns

## Risks & Mitigations
1. **Risk**: Iframe security vulnerabilities
   **Mitigation**: Use strict sandbox attributes and Content Security Policy
2. **Risk**: Game performance degradation when embedded
   **Mitigation**: Test thoroughly and optimize iframe loading, consider lazy loading
3. **Risk**: Mobile touch controls not working properly in iframe
   **Mitigation**: Extensive mobile testing, fallback touch handling if needed
4. **Risk**: Game assets not accessible in production deployment
   **Mitigation**: Verify asset paths and copy game files to appropriate public directory
5. **Risk**: Character theme integration looks inconsistent
   **Mitigation**: Design comprehensive theme system that wraps game without interfering

## Future Enhancements
- Add high score tracking integrated with wedding app user system
- Implement multiplayer/tournament features for wedding guests
- Add more classic games using similar iframe integration pattern
- Create game achievements system tied to wedding app gamification
- Add social sharing features for high scores and achievements