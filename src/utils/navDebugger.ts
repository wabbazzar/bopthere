interface NavEvent {
  timestamp: number;
  component: string;
  action: string;
  details?: Record<string, unknown>;
  elementInfo?: {
    id?: string;
    className?: string;
    tagName?: string;
    isClickable?: boolean;
    hasPointerEvents?: boolean;
    zIndex?: string;
    position?: string;
  };
}

class NavigationDebugger {
  private events: NavEvent[] = [];
  private isEnabled: boolean = false;
  private maxEvents: number = 100;

  constructor() {
    // Enable debugging through localStorage or URL params
    this.isEnabled = 
      localStorage.getItem('nav-debug') === 'true' ||
      new URLSearchParams(window.location.search).has('nav-debug');
    
    if (this.isEnabled) {
      console.log('🔍 Navigation Debugger Enabled');
      this.setupGlobalListeners();
    }
  }

  private setupGlobalListeners() {
    // Listen for all click events to detect if they're being intercepted
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) {
        this.log('global', 'click-detected', {
          targetSelector: this.getElementSelector(target),
          eventPhase: e.eventPhase,
          propagationStopped: e.defaultPrevented,
          bubbles: e.bubbles,
          composed: e.composed
        });
      }
    }, true); // Capture phase to catch early
    
    // Monitor for elements that might block clicks
    setInterval(() => {
      const potentialBlockers = document.querySelectorAll('.fixed.inset-0, [data-radix-dialog-overlay], [role="dialog"]');
      if (potentialBlockers.length > 0) {
        const blockers = Array.from(potentialBlockers).map(el => {
          const computed = window.getComputedStyle(el);
          return {
            selector: this.getElementSelector(el as HTMLElement),
            zIndex: computed.zIndex,
            pointerEvents: computed.pointerEvents,
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            dataState: el.getAttribute('data-state'),
            role: el.getAttribute('role'),
            isVisible: computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0'
          };
        });
        
        // Only log if there are visible blockers
        const visibleBlockers = blockers.filter(b => b.isVisible && b.pointerEvents !== 'none');
        if (visibleBlockers.length > 0) {
          this.log('global', 'potential-click-blockers', {
            count: visibleBlockers.length,
            blockers: visibleBlockers,
            // Add more details for debugging
            details: visibleBlockers.map(b => ({
              selector: b.selector,
              zIndex: b.zIndex,
              role: b.role,
              dataState: b.dataState
            }))
          });
        }
      }
    }, 2000); // Check every 2 seconds

    // Monitor pointer events being disabled
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || 
             mutation.attributeName === 'class' ||
             mutation.attributeName === 'disabled')) {
          const target = mutation.target as HTMLElement;
          if (target.tagName === 'BUTTON' || target.closest('button')) {
            this.log('global', 'button-mutation', {
              attributeName: mutation.attributeName,
              oldValue: mutation.oldValue,
              newValue: target.getAttribute(mutation.attributeName || ''),
              selector: this.getElementSelector(target)
            });
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      attributeFilter: ['style', 'class', 'disabled']
    });
  }

  private getElementSelector(element: HTMLElement): string {
    const parts: string[] = [];
    
    if (element.id) {
      parts.push(`#${element.id}`);
    }
    
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        parts.push(`.${classes.slice(0, 3).join('.')}`);
      }
    }
    
    parts.push(element.tagName.toLowerCase());
    
    return parts.join(' ');
  }

  private getElementInfo(element: HTMLElement | null): NavEvent['elementInfo'] {
    if (!element) return undefined;

    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return {
      id: element.id || undefined,
      className: element.className || undefined,
      tagName: element.tagName,
      isClickable: !element.hasAttribute('disabled') && 
                   computedStyle.pointerEvents !== 'none' &&
                   computedStyle.visibility !== 'hidden' &&
                   computedStyle.display !== 'none',
      hasPointerEvents: computedStyle.pointerEvents !== 'none',
      zIndex: computedStyle.zIndex,
      position: computedStyle.position
    };
  }

  log(component: string, action: string, details?: Record<string, unknown>, element?: HTMLElement | null) {
    if (!this.isEnabled) return;

    const event: NavEvent = {
      timestamp: Date.now(),
      component,
      action,
      details,
      elementInfo: element ? this.getElementInfo(element) : undefined
    };

    this.events.push(event);
    
    // Keep only the last N events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Console log with styling
    const style = action.includes('error') || action.includes('fail') 
      ? 'background: #ff0000; color: white; padding: 2px 4px; border-radius: 2px;'
      : 'background: #0066cc; color: white; padding: 2px 4px; border-radius: 2px;';

    console.log(
      `%c[${component}] ${action}`,
      style,
      {
        ...details,
        elementInfo: event.elementInfo,
        timestamp: new Date(event.timestamp).toLocaleTimeString()
      }
    );

    // Check for potential issues
    if (element && event.elementInfo && !event.elementInfo.isClickable) {
      const computedStyle = window.getComputedStyle(element);
      console.warn('⚠️ Button may not be clickable:', {
        selector: this.getElementSelector(element),
        reasons: {
          disabled: element.hasAttribute('disabled'),
          pointerEventsNone: event.elementInfo.hasPointerEvents === false,
          hidden: computedStyle.visibility === 'hidden' || computedStyle.display === 'none'
        }
      });
    }
  }

  getEvents(): NavEvent[] {
    return [...this.events];
  }

  getRecentEvents(count: number = 10): NavEvent[] {
    return this.events.slice(-count);
  }

  findEventsBy(filter: Partial<NavEvent>): NavEvent[] {
    return this.events.filter(event => {
      return Object.entries(filter).every(([key, value]) => {
        return event[key as keyof NavEvent] === value;
      });
    });
  }

  enable() {
    this.isEnabled = true;
    localStorage.setItem('nav-debug', 'true');
    console.log('🔍 Navigation Debugger Enabled');
    window.location.reload(); // Reload to setup listeners
  }

  disable() {
    this.isEnabled = false;
    localStorage.removeItem('nav-debug');
    console.log('🔍 Navigation Debugger Disabled');
  }

  clear() {
    this.events = [];
    console.log('🔍 Navigation Debug Events Cleared');
  }

  exportLogs(): string {
    return JSON.stringify(this.events, null, 2);
  }
}

// Create singleton instance
export const navDebugger = new NavigationDebugger();

// Export for console access
if (typeof window !== 'undefined') {
  (window as Window & { navDebugger: NavigationDebugger }).navDebugger = navDebugger;
  
  // Add helper message
  const isDebugEnabled = localStorage.getItem('nav-debug') === 'true' ||
    new URLSearchParams(window.location.search).has('nav-debug');
  
  if (isDebugEnabled) {
    console.log('💡 Navigation Debugger Commands:');
    console.log('  navDebugger.getRecentEvents() - Show recent events');
    console.log('  navDebugger.exportLogs() - Export all logs');
    console.log('  navDebugger.disable() - Turn off debugging');
    console.log('  navDebugger.clear() - Clear event log');
    console.log('  navDebugger.showBlockers() - Show current blocking elements');
  }
  
  // Add helper function to inspect blockers
  (navDebugger as any).showBlockers = () => {
    const potentialBlockers = document.querySelectorAll('.fixed.inset-0, [data-radix-dialog-overlay], [role="dialog"]');
    const blockers = Array.from(potentialBlockers).map(el => {
      const computed = window.getComputedStyle(el);
      return {
        element: el,
        selector: el.className || el.tagName,
        zIndex: computed.zIndex,
        pointerEvents: computed.pointerEvents,
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        position: computed.position,
        dataState: el.getAttribute('data-state'),
        role: el.getAttribute('role'),
        dimensions: `${el.clientWidth}x${el.clientHeight}`,
        isVisible: computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0'
      };
    });
    console.table(blockers);
    return blockers;
  };
}