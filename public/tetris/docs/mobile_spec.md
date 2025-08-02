# Tetris Turbo Mobile - Mobile-First Specification

## Project Overview
Adapt the existing Tetris Turbo game for mobile-first design, specifically optimized for iPhone and mobile devices. Transform the desktop keyboard-controlled experience into an intuitive touch-based mobile gaming experience while maintaining the Tron aesthetic and game performance.

## Mobile-Specific Requirements

### Target Devices
- **Primary**: iPhone (iOS Safari)
- **Secondary**: Android devices (Chrome Mobile)
- **Screen Sizes**: 375px - 428px width (iPhone SE to iPhone Pro Max)
- **Orientation**: Portrait-first design
- **Performance**: 60 FPS on iPhone 8+ and equivalent Android devices

### Touch Control System

#### Gesture Controls (Primary Interface)
- **Grid Tap**: Rotate piece clockwise
  - Single tap anywhere within the game board grid
  - Visual rotation feedback with piece preview
  - Immediate response (no delay)
- **Slide Down**: Soft drop (accelerated falling)
  - Vertical swipe down gesture within game board
  - Continuous movement while finger held down
  - Smooth acceleration curve
  - Visual downward movement feedback
- **Swipe Left**: Move piece left
  - Horizontal swipe left gesture anywhere on game board
  - Quick swipe motion (minimum 30px distance)
  - Immediate leftward movement with visual feedback
  - Works alongside left zone tapping
- **Swipe Right**: Move piece right
  - Horizontal swipe right gesture anywhere on game board
  - Quick swipe motion (minimum 30px distance)
  - Immediate rightward movement with visual feedback
  - Works alongside right zone tapping
- **Left Zone Tap**: Move piece left (Alternative Method)
  - Tap anywhere to the left of the game board
  - Immediate leftward movement
  - Visual feedback in left zone
- **Right Zone Tap**: Move piece right (Alternative Method)
  - Tap anywhere to the right of the game board  
  - Immediate rightward movement
  - Visual feedback in right zone
- **Long Press (Game Board)**: Hard drop (instant placement)
  - 500ms press duration anywhere within game board
  - Immediate drop with visual trail effect
  - Haptic feedback confirmation
- **Scoreboard Tap**: Pause/unpause game
  - Tap anywhere on the score/level header area
  - Visual pause indicator overlay
  - Clean separation from gameplay controls
- **Pause Overlay Tap**: Resume game when paused
  - Tap anywhere on the pause overlay to resume
  - Mobile-friendly large touch target
  - Clear visual instructions

#### Touch Zone Layout
- **Game Board Zone**: Central rectangle containing the 10x20 grid
  - Primary interaction area for rotation, slide down, swipe left/right, and long press hard drop
  - Visual grid boundaries clearly defined
  - Tap feedback with subtle glow effect
  - Swipe gesture recognition for horizontal movement
- **Left Movement Zone**: Area to the left of game board
  - Extends from screen edge to game board left border
  - Visual indicator when tapped (left arrow effect)
  - Comfortable thumb-reachable area
- **Right Movement Zone**: Area to the right of game board  
  - Extends from game board right border to screen edge
  - Visual indicator when tapped (right arrow effect)
  - Comfortable thumb-reachable area
- **Scoreboard Zone**: Header area with score and level display
  - Tap anywhere in header to pause/unpause
  - Visual pause indicator when activated
  - Clean separation from gameplay controls

#### Touch Button Controls (Secondary Interface)
- **Removed**: Traditional button controls eliminated for cleaner UI
- **Zone-Based**: Intuitive spatial control system replaces buttons
- **Visual Feedback**: Clear zone boundaries with touch indicators
- **Accessibility**: Large touch targets with clear visual hierarchy
- **Menu/Overlay Buttons**: 
  - Touch-optimized start/restart buttons with both click and touchstart events
  - Minimum 44px touch targets for accessibility
  - Visual hover/active states for feedback

### Mobile UX Design

#### Layout Adaptations
- **Game Board**: 
  - Scale to 85% of screen width in portrait
  - Maintain aspect ratio (1:2 ratio)
  - Center horizontally with equal margins
- **Score/Level Display**:
  - Move to top of screen above game board
  - Horizontal layout: Score | Level | Lines
  - Larger, more readable fonts
- **Control Area**:
  - Bottom third of screen
  - Primary gesture area for game board
  - Secondary button controls below
- **Next Piece Preview**:
  - Header area, top-right corner
  - Small 3x3 or 4x4 mini-grid
  - Maintains piece color and glow effects
  - Space-efficient design for mobile
  - Toggleable in minimal UI mode

#### Visual Feedback System
- **Touch Indicators**: 
  - Subtle glow effect where finger touches
  - Gesture trail visualization for swipes
  - Directional swipe arrows for left/right movements
  - Button press animations
- **Combo Animations**:
  - Double lines: Orange wave with double-pulse haptic
  - Triple lines: Purple ripple with triple-pulse haptic
  - Tetris: Rainbow explosion with celebration haptic pattern
  - Mobile-responsive text sizing and point display
  - Single lines: No animation (reduces visual noise)
- **Level Up Animation**:
  - Subtle cyan flash overlay on level advancement
  - "LEVEL X" text display with neon glow effect
  - Mobile-optimized text sizing and positioning
- **Haptic Feedback**:
  - Piece placement vibration
  - Line clear celebration vibration (combo-specific patterns)
  - Level up double-pulse vibration pattern
  - Collision/rotation failure light buzz
- **Audio Considerations**:
  - Respect iOS silent mode
  - Optional sound effects toggle
  - Brief audio cues for actions

### Progressive Web App (PWA) Features

#### App-Like Experience
- **Web App Manifest**: Add to home screen capability
- **Service Worker**: Offline gameplay support
- **App Icons**: iOS/Android compatible icons
- **Splash Screen**: Loading experience
- **Status Bar**: Immersive full-screen mode

#### Performance Optimizations
- **Reduced DOM Manipulation**: 
  - Batch all touch-related updates
  - Optimize rendering for mobile browsers
  - Minimize reflows and repaints
- **Touch Event Optimization**:
  - Passive event listeners where possible
  - Debounced gesture recognition
  - Efficient touch coordinate tracking
- **Memory Management**:
  - Clean up touch event listeners
  - Optimize piece rendering for mobile
  - Reduce JavaScript heap usage

### Responsive Design Implementation

#### Breakpoint Strategy
- **Small Mobile**: 320px - 374px (iPhone SE)
- **Standard Mobile**: 375px - 413px (iPhone 12/13)
- **Large Mobile**: 414px - 428px (iPhone Pro Max)
- **Tablet Portrait**: 768px+ (fallback to desktop layout)

#### CSS Adaptations
- **Flexible Grid System**: CSS Grid for responsive game board
- **Touch-Friendly Sizing**: 
  - Minimum 44px touch targets
  - Adequate spacing between interactive elements
  - Larger game cells for better visibility
- **Typography Scale**: 
  - Responsive font sizes using clamp()
  - High contrast for mobile readability
  - System font stack for performance

### Mobile-Specific Game Features

#### Accessibility Enhancements
- **High Contrast Mode**: Enhanced visibility option
- **Larger Touch Targets**: Accessibility-friendly controls
- **Voice Over Support**: Screen reader compatibility
- **Reduced Motion**: Respect user motion preferences

#### Game State Persistence
- **Local Storage**: Save game progress
- **Auto-Pause**: Handle phone calls/notifications
- **Background Handling**: Pause when app loses focus
- **Resume Capability**: Restore game state on return
- **Enhanced Game Over**: Display both final score and level attained

#### Social Features (Optional)
- **Score Sharing**: Share achievements via native share
- **Screenshot Capture**: Game state image generation
- **Leaderboard**: Local high score tracking

## Technical Implementation Requirements

### HTML Structure Updates
- **Viewport Configuration**: Proper mobile viewport settings
- **Touch Action CSS**: Prevent default touch behaviors
- **Meta Tags**: iOS-specific web app configurations
- **Semantic Markup**: Screen reader and accessibility support

### CSS Mobile-First Approach
- **Mobile Base Styles**: Start with mobile layout
- **Progressive Enhancement**: Desktop as enhancement
- **Flexbox/Grid**: Modern layout techniques
- **CSS Custom Properties**: Dynamic sizing and theming

### JavaScript Touch Events
- **Touch Event Handlers**: 
  - touchstart, touchmove, touchend
  - Gesture recognition algorithms
  - Multi-touch prevention
- **Performance Monitoring**:
  - Frame rate tracking on mobile
  - Touch responsiveness metrics
  - Memory usage optimization

### Testing Requirements
- **Device Testing**: Physical device validation
- **Cross-Browser**: Safari, Chrome Mobile, Samsung Internet
- **Performance Testing**: 60 FPS maintenance
- **Accessibility Testing**: VoiceOver, TalkBack compatibility
- **Network Conditions**: Offline capability testing

## Success Criteria

### Functional Requirements
- All original Tetris mechanics work via touch
- Smooth 60 FPS performance on target devices
- Intuitive gesture recognition (< 50ms response time)
- Proper game state management (pause/resume)
- PWA installation capability
- Offline gameplay support

### User Experience Requirements
- Intuitive controls (< 30 seconds to learn)
- Responsive visual feedback (immediate touch response)
- No accidental inputs or gestures
- Comfortable extended play sessions
- Respect for device settings (silent mode, motion)

### Performance Requirements
- **Load Time**: < 3 seconds on 3G connection
- **Frame Rate**: Consistent 60 FPS during gameplay
- **Touch Latency**: < 50ms input to visual response
- **Battery Usage**: Efficient power consumption
- **Memory Usage**: < 50MB RAM footprint

### Visual Design Requirements
- Maintain Tron aesthetic on mobile
- High contrast for outdoor visibility
- Readable typography at all sizes
- Consistent visual feedback system
- Smooth animations and transitions

## Development Priorities

### Must-Have (Core Mobile Functionality)
1. Touch gesture system (swipe, tap, double-tap)
2. Responsive layout for portrait mobile
3. Touch-friendly UI controls
4. Performance optimization for 60 FPS
5. Next piece preview in header
6. Level up flash animation with haptic feedback
7. Combo animations with haptic patterns (Double/Triple/Tetris)
8. Basic PWA features (manifest, icons)

### Should-Have (Enhanced Mobile UX)
1. Haptic feedback integration
2. Advanced gesture recognition
3. Game state persistence
4. Accessibility enhancements
5. Cross-device testing validation

### Nice-to-Have (Premium Mobile Features)
1. Social sharing capabilities
2. Advanced PWA features (offline)
3. High contrast/accessibility modes
4. Voice control integration
5. Advanced haptic patterns

## Technical Constraints

### Device Limitations
- **iOS Safari**: WebKit limitations and quirks
- **Memory**: Limited RAM on older devices
- **CPU**: Throttling during extended gameplay
- **Battery**: Power-efficient rendering required
- **Network**: Offline-first approach

### Browser Compatibility
- **iOS Safari**: Primary target (iOS 13+)
- **Chrome Mobile**: Android compatibility
- **Samsung Internet**: Samsung device optimization
- **Progressive Enhancement**: Fallback for older browsers

This mobile specification maintains the core Tetris experience while transforming it into a modern, touch-first mobile gaming experience optimized for iPhone and mobile devices.
