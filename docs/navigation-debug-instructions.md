# Navigation Button Debug Instructions

## How to Enable Debug Mode

### Method 1: URL Parameter (Temporary)
Add `?nav-debug` to the URL:
```
http://localhost:5173/?nav-debug
```

### Method 2: Browser Console (Persistent)
1. Open browser developer tools (F12)
2. In the console, run:
```javascript
localStorage.setItem('nav-debug', 'true');
location.reload();
```

## Debug Commands

Once enabled, you'll see debug logs in the console. Available commands:

```javascript
// View recent navigation events
navDebugger.getRecentEvents()

// View all events
navDebugger.getEvents()

// Export logs for sharing
navDebugger.exportLogs()

// Clear event history
navDebugger.clear()

// Disable debug mode
navDebugger.disable()
```

## What to Look For

When reproducing the unclickable hamburger issue:

1. **After Login**: Look for these events in sequence:
   - `[LoginModal] login-success`
   - `[CharacterSwitcher] auth-state-changed`
   - `[FestivalNav] state-changed`

2. **Check Button State**: Look for warnings like:
   - `⚠️ Button may not be clickable`
   - Check the `elementInfo` in each event

3. **Event Flow**: Verify these events fire when clicking hamburger:
   - `[FestivalNav] hamburger-pointer-down`
   - `[FestivalNav] hamburger-click-attempt`
   - `[global] click-detected`

4. **Mutations**: Watch for `button-mutation` events that might indicate:
   - Style changes
   - Class changes
   - Disabled attribute changes

## Sharing Debug Logs

1. Reproduce the issue with debug mode enabled
2. Run `navDebugger.exportLogs()` in console
3. Copy the output and share with developers

## Common Issues to Check

- **Z-index conflicts**: Check if modal overlays are blocking buttons
- **Pointer-events**: Look for `pointerEvents: none` in elementInfo
- **React re-renders**: Multiple rapid state changes after login
- **Event handlers**: Missing or improperly cleaned up event listeners