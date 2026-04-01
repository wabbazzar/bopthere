/**
 * Utility to ensure UI elements remain clickable by removing blocking overlays
 * and resetting pointer events
 */

export function ensureUIClickable() {
  // Only remove truly orphaned dialog overlays
  const dialogOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
  dialogOverlays.forEach((el) => {
    const dialogState = el.getAttribute('data-state');
    const isClosing = dialogState === 'closed';

    // Only remove if dialog is in closed state
    if (isClosing) {
      setTimeout(() => {
        if (el.parentNode) {
          el.remove();
          console.warn('Removed closed dialog overlay');
        }
      }, 300); // Wait for animation
    }
  });

  // Only reset body styles if no active dialogs
  const activeDialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
  if (activeDialogs.length === 0) {
    // Only reset if styles are actually set
    if (document.body.style.overflow) {
      document.body.style.overflow = '';
    }
    if (document.documentElement.style.overflow) {
      document.documentElement.style.overflow = '';
    }
  }

  // Don't force pointer-events on all buttons - this is too aggressive
  // Only fix specific navigation elements that are wrongly disabled
  const hamburgerMenu = document.querySelector('button[key="hamburger-menu-button"]');
  if (hamburgerMenu && (hamburgerMenu as HTMLElement).style.pointerEvents === 'none') {
    (hamburgerMenu as HTMLElement).style.pointerEvents = '';
  }
}

// Run cleanup periodically and after certain events
export function setupClickabilityMonitor() {
  // Don't run initial cleanup immediately - wait for app to stabilize
  setTimeout(ensureUIClickable, 1000);

  // Only observe dialog-specific changes
  const observer = new MutationObserver((mutations) => {
    const hasDialogChange = mutations.some(
      (m) =>
        m.target instanceof Element &&
        m.target.hasAttribute('data-radix-dialog-overlay') &&
        m.attributeName === 'data-state'
    );

    if (hasDialogChange) {
      setTimeout(ensureUIClickable, 600);
    }
  });

  // Only observe the specific elements we care about
  observer.observe(document.body, {
    childList: false,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-state'],
  });

  // Reduce frequency of periodic cleanup
  const interval = setInterval(ensureUIClickable, 10000); // 10 seconds instead of 3

  return () => {
    observer.disconnect();
    clearInterval(interval);
  };
}
