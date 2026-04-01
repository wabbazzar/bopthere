# Tetris Web App Specification

## Project Overview
Build a fully functional Tetris game that runs locally in a browser with modern Tron-style aesthetic. Target development time: 5 minutes using agentic development.

## Technical Requirements

### Tech Stack
- **Pure HTML/CSS/JavaScript** (single file, no dependencies)
- Must work locally in browser
- No external libraries or frameworks

### Browser Compatibility
- Target modern browsers (Chrome, Firefox, Safari, Edge)
- Use standard JavaScript features (ES6+)
- Avoid experimental APIs

### Game Board
- **Standard Tetris dimensions:** 10 columns × 20 rows
- Grid-based layout for piece placement

## Core Gameplay Mechanics

### Tetris Pieces
- **All 7 standard pieces:** I, O, T, S, Z, J, L shapes
- Each piece type should have distinct neon color
- 4-direction rotation capability for all pieces

### Controls (Keyboard Only)
- **Left Arrow / A:** Move piece left
- **Right Arrow / D:** Move piece right  
- **Down Arrow / S:** Soft drop (faster falling)
- **Up Arrow / W:** Rotate piece clockwise
- **Spacebar:** Hard drop (instant placement)
- **P:** Pause/unpause game (works both when running and paused)
- **R:** Restart (when game over)

### Game Logic
- **Line Clearing:** Remove completely filled horizontal rows
- **Piece Placement:** Pieces lock when they can't fall further
- **Game Over:** When pieces reach the top of the board
- **Collision Detection:** Pieces cannot overlap or move outside boundaries

### Scoring System
- Points awarded for cleared lines
- Bonus points for multiple lines cleared simultaneously
- Display current score prominently

### Difficulty Progression
- **Traditional Tetris level system** (Level 1, 2, 3, etc.)
- Pieces fall faster as level increases
- Level advancement based on lines cleared (typically every 10 lines)
- Display current level alongside score

## Visual Design: Tron Aesthetic

### Color Scheme
- **Background:** Pure black or very dark (#000000 or #0a0a0a)
- **Neon Colors for Pieces:**
  - Bright cyan (#00ffff)
  - Electric orange (#ff6600) 
  - Neon green (#00ff00)
  - Hot pink (#ff0099)
  - Electric blue (#0099ff)
  - Bright yellow (#ffff00)
  - Purple/magenta (#9900ff)

### Visual Effects
- **Glowing Effects:** All game pieces should have CSS glow/shadow effects
- **Grid Lines:** Subtle glowing grid pattern on game board
- **Line Clear Explosions:** Animated neon "explosion" effect when lines are cleared
- **Combo Animations:** Distinct animations for multi-line clears:
  - Double (2 lines): Orange wave with 3D flip
  - Triple (3 lines): Purple ripple with rotation
  - Tetris (4 lines): Epic rainbow explosion with spinning text
- **Level Up Animation:** Subtle cyan flash effect with "LEVEL X" text when advancing levels
- **Background Grid:** Subtle Tron-style background grid pattern
- **Neon Text:** Score and level display in glowing, retro-style font
- **Piece Differentiation:** Use gradients on blocks to distinguish adjacent same-colored pieces

### UI Elements
- **Score Display:** Top of screen, neon green glow
- **Level Display:** Alongside score, neon cyan
- **Next Piece Preview:** Right side panel, small 4x4 grid with next piece shown in proper color/glow
- **Game Menu Overlay:** 
  - Start screen with neon "Tetris Turbo" title
  - Control instructions for both mobile and desktop
  - Gradient start button with hover effects
- **Pause Overlay:** Yellow neon "Paused" text with resume instructions
- **Game Over Screen:** Pink neon "Game Over" with final score and restart button
  - Displays final score with neon green glow
  - Shows level attained with neon cyan glow  
  - Restart button to begin new game
  - Maintains Tron aesthetic consistency

## Implementation Priorities

### Must-Have (Core Functionality)
1. All 7 pieces with proper rotation
2. Movement and collision detection
3. Line clearing mechanics
4. Basic scoring
5. Level progression with speed increase
6. Game over detection

### Should-Have (Visual Polish)
1. Tron color scheme (dark + neon)
2. Basic glow effects on pieces
3. Grid line styling
4. Neon score/level text
5. Next piece preview with mini-grid
6. Level up flash animation with text
7. Combo animations for multi-line clears (Double/Triple/Tetris)

### Nice-to-Have (Enhanced Effects)
1. Line-clearing explosion animations
2. Subtle background grid pattern
3. Enhanced glow effects
4. Smooth piece movement animations

## File Structure
- **Single HTML file** containing embedded CSS and JavaScript
- Self-contained and portable
- Can be opened directly in any modern browser

## Success Criteria
- Game runs smoothly in browser
- All Tetris mechanics work correctly
- Visually appealing Tron aesthetic
- Intuitive keyboard controls
- Progressive difficulty through levels
- Clean, modern arcade feel

## Development Notes
- Prioritize functionality over visual effects if time is constrained
- Use CSS transforms and transitions for smooth animations
- Implement game loop using requestAnimationFrame for smooth gameplay
- Consider using CSS Grid or Flexbox for board layout
- Test across different browsers if time permits

### Performance Optimization
- **Minimize DOM manipulation:** Update only changed cells, not entire board
- **Use CSS classes instead of inline styles** for better performance
- **Batch DOM updates:** Group multiple cell updates together
- **Avoid forced reflows:** Don't read layout properties immediately after writes
- **Input handling:** Implement key repeat delay for smoother controls