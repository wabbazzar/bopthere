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
    // Intentionally no-op: Avoid mutating DOM nodes that React/Radix manage.
    // Historical issues showed that removing overlays or toggling pointer-events
    // on global fixed elements can conflict with React's reconciliation and
    // Radix Dialog's focus management, causing NotFoundError and aria-hidden warnings.
  }
}

// Create singleton instance
export const navbarProtector = new NavbarProtector();

// Do not auto-start. Consumers should start/stop explicitly (e.g., in App lifecycle)
if (typeof window !== 'undefined') {
  (window as Window & { navbarProtector?: NavbarProtector }).navbarProtector = navbarProtector;
}
