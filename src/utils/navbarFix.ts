/**
 * Utility to ensure navbar remains functional when DevTools is open
 * This addresses issues where the navbar becomes unclickable when F12 is pressed
 */

export class NavbarProtector {
  private observer: MutationObserver | null = null;
  private intervalId: number | null = null;

  start() {
    // Ensure nav elements remain interactive
    this.intervalId = window.setInterval(() => {
      this.ensureNavInteractive();
      this.removeBlockingOverlays();
    }, 500);

    // Watch for DOM changes that might block the nav
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if any blocking elements were added
          this.removeBlockingOverlays();
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial cleanup
    this.ensureNavInteractive();
    this.removeBlockingOverlays();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private ensureNavInteractive() {
    // Find the main nav element
    const nav = document.querySelector('nav');
    if (nav) {
      // Force pointer events on nav
      (nav as HTMLElement).style.pointerEvents = 'auto';

      // Ensure nav has high z-index
      const currentZIndex = parseInt(window.getComputedStyle(nav).zIndex || '0', 10);
      if (currentZIndex < 100) {
        (nav as HTMLElement).style.zIndex = '100';
      }

      // Make all buttons in nav clickable
      const buttons = nav.querySelectorAll('button');
      buttons.forEach((button) => {
        (button as HTMLElement).style.pointerEvents = 'auto';
      });
    }
  }

  private removeBlockingOverlays() {
    // Check for orphaned dialog overlays
    const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
    overlays.forEach((overlay) => {
      const dialog = overlay.closest('[role="dialog"]');
      const dataState = overlay.getAttribute('data-state');

      // If overlay exists but dialog is closed or missing, remove it
      if (!dialog || dataState === 'closed') {
        overlay.remove();
        console.log('Removed orphaned dialog overlay');
      }
    });

    // Check for invisible blocking elements
    const potentialBlockers = document.querySelectorAll('.fixed.inset-0');
    potentialBlockers.forEach((element) => {
      const computed = window.getComputedStyle(element);
      const isNav = element.tagName === 'NAV' || element.closest('nav');

      // Skip if it's part of navigation
      if (isNav) return;

      // Remove if it's invisible but still blocking
      if (
        computed.opacity === '0' &&
        computed.pointerEvents !== 'none' &&
        !element.querySelector(':scope > *') // No children
      ) {
        (element as HTMLElement).style.pointerEvents = 'none';
        console.log('Disabled pointer events on invisible blocker');
      }
    });
  }
}

// Create singleton instance
export const navbarProtector = new NavbarProtector();

// Auto-start protection
if (typeof window !== 'undefined') {
  // Start protection when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => navbarProtector.start());
  } else {
    navbarProtector.start();
  }

  // Expose to console for debugging
  (window as Window & { navbarProtector?: NavbarProtector }).navbarProtector = navbarProtector;
}
