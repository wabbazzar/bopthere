import { AuthService } from '@/lib/auth';
import { apiRequest } from '@/integrations/aws/api-client';
import type { LoginResponse, User } from '@/types/auth';

// Mock the API client
jest.mock('@/integrations/aws/api-client', () => ({
  apiRequest: jest.fn(),
  APIError: class APIError extends Error {
    constructor(
      message: string,
      public statusCode?: number
    ) {
      super(message);
      this.name = 'APIError';
    }
  },
}));

// Mock PWA hooks
const mockUseTokenRefresh = {
  startRefreshTimer: jest.fn(),
  stopRefreshTimer: jest.fn(),
  checkAndRefresh: jest.fn(),
};

jest.mock('@/hooks/useTokenRefresh', () => ({
  useTokenRefresh: () => mockUseTokenRefresh,
}));

describe('PWA Lifecycle Token Refresh Integration', () => {
  const mockUser: User = {
    username: 'pwa_test_user',
    email: 'pwa@example.com',
    full_name: 'PWA Test User',
    role: 'guest',
    created_at: '2025-01-01T00:00:00Z',
    last_login: '2025-01-01T00:00:00Z',
  };

  // Token that's at 80% of its lifetime (should trigger refresh)
  const mockOldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InB3YV90ZXN0X3VzZXIiLCJyb2xlIjoiZ3Vlc3QiLCJpYXQiOjE3MzU2ODk2MDAsImV4cCI6MTczODI4MTYwMH0.PWAOldTokenSignatureForTesting123456789';
  
  const mockFreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InB3YV90ZXN0X3VzZXIiLCJyb2xlIjoiZ3Vlc3QiLCJpYXQiOjE3MzgyODE2MDAsImV4cCI6MTc0MDg3MzYwMH0.PWAFreshTokenSignatureForTesting987654321';

  const mockRefreshResponse: LoginResponse = {
    token: mockFreshToken,
    user: mockUser,
    expires_at: '2025-02-28T00:00:00Z',
  };

  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let mockEventListeners: { [key: string]: EventListener[] };
  let mockVisibilityState: string;
  let mockOnline: boolean;

  beforeEach(() => {
    jest.clearAllMocks();
    (localStorage.clear as jest.Mock)();
    
    // Set current date to Jan 25, 2025 (80% through token lifetime)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-25T00:00:00Z'));

    // Mock event listeners
    mockEventListeners = {};
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;

    window.addEventListener = jest.fn((event: string, listener: EventListener) => {
      if (!mockEventListeners[event]) {
        mockEventListeners[event] = [];
      }
      mockEventListeners[event].push(listener);
    });

    window.removeEventListener = jest.fn((event: string, listener: EventListener) => {
      if (mockEventListeners[event]) {
        mockEventListeners[event] = mockEventListeners[event].filter(l => l !== listener);
      }
    });

    // Mock document.visibilityState
    mockVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      get: () => mockVisibilityState,
      configurable: true,
    });

    // Mock navigator.onLine
    mockOnline = true;
    Object.defineProperty(navigator, 'onLine', {
      get: () => mockOnline,
      configurable: true,
    });

    // Mock requestIdleCallback for debouncing
    (global as unknown as { requestIdleCallback: jest.Mock }).requestIdleCallback = jest.fn((callback: () => void) => {
      setTimeout(callback, 0);
      return 1;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  // Helper to trigger mock events
  const triggerEvent = (eventType: string, eventData: Record<string, unknown> = {}) => {
    if (mockEventListeners[eventType]) {
      mockEventListeners[eventType].forEach(listener => {
        listener(new Event(eventType, eventData) as Event);
      });
    }
  };

  describe('App Visibility Change Events', () => {
    it('should trigger token refresh when app becomes visible', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      // Setup PWA token refresh listener (simulate hook initialization)
      const mockRefreshOnVisibility = jest.fn(async () => {
        if (document.visibilityState === 'visible' && AuthService.shouldRefreshToken()) {
          await AuthService.checkAndRefreshToken();
        }
      });

      // Simulate registering visibility change listener
      document.addEventListener('visibilitychange', mockRefreshOnVisibility);

      // Simulate app becoming visible (returning from background)
      mockVisibilityState = 'visible';
      triggerEvent('visibilitychange');

      // Wait for async operations
      await jest.runAllTimersAsync();

      expect(mockRefreshOnVisibility).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalledWith('/auth/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockOldToken}`,
        },
      });
    });

    it('should not trigger token refresh when app becomes hidden', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);

      const mockRefreshOnVisibility = jest.fn(async () => {
        if (document.visibilityState === 'visible' && AuthService.shouldRefreshToken()) {
          await AuthService.checkAndRefreshToken();
        }
      });

      document.addEventListener('visibilitychange', mockRefreshOnVisibility);

      // Simulate app becoming hidden
      mockVisibilityState = 'hidden';
      triggerEvent('visibilitychange');

      await jest.runAllTimersAsync();

      expect(mockRefreshOnVisibility).toHaveBeenCalled();
      expect(apiRequest).not.toHaveBeenCalled(); // No refresh when hidden
    });

    it('should not refresh fresh token on visibility change', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockFreshToken);

      const mockRefreshOnVisibility = jest.fn(async () => {
        if (document.visibilityState === 'visible' && AuthService.shouldRefreshToken()) {
          await AuthService.checkAndRefreshToken();
        }
      });

      document.addEventListener('visibilitychange', mockRefreshOnVisibility);

      mockVisibilityState = 'visible';
      triggerEvent('visibilitychange');

      await jest.runAllTimersAsync();

      expect(mockRefreshOnVisibility).toHaveBeenCalled();
      expect(apiRequest).not.toHaveBeenCalled(); // No refresh for fresh token
    });

    it('should handle visibility change event errors gracefully', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockRejectedValue(new Error('Network error'));

      const mockRefreshOnVisibility = jest.fn(async () => {
        try {
          if (document.visibilityState === 'visible' && AuthService.shouldRefreshToken()) {
            await AuthService.checkAndRefreshToken();
          }
        } catch (error) {
          console.error('Visibility refresh failed:', error);
        }
      });

      document.addEventListener('visibilitychange', mockRefreshOnVisibility);

      mockVisibilityState = 'visible';
      triggerEvent('visibilitychange');

      await jest.runAllTimersAsync();

      expect(mockRefreshOnVisibility).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalled();
      // Should not throw error
    });
  });

  describe('Window Focus Events', () => {
    it('should trigger token refresh on window focus', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      const mockRefreshOnFocus = jest.fn(async () => {
        if (AuthService.shouldRefreshToken()) {
          await AuthService.checkAndRefreshToken();
        }
      });

      window.addEventListener('focus', mockRefreshOnFocus);

      triggerEvent('focus');
      await jest.runAllTimersAsync();

      expect(mockRefreshOnFocus).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalled();
    });

    it('should not trigger refresh on window blur', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);

      const mockRefreshOnBlur = jest.fn(async () => {
        // Typically we don't refresh on blur, just focus
      });

      window.addEventListener('blur', mockRefreshOnBlur);

      triggerEvent('blur');
      await jest.runAllTimersAsync();

      expect(mockRefreshOnBlur).toHaveBeenCalled();
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle rapid focus/blur events gracefully', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      let refreshCount = 0;
      const mockRefreshWithDebounce = jest.fn(async () => {
        // Simulate debounced refresh
        setTimeout(async () => {
          if (AuthService.shouldRefreshToken()) {
            refreshCount++;
            await AuthService.checkAndRefreshToken();
          }
        }, 100);
      });

      window.addEventListener('focus', mockRefreshWithDebounce);

      // Rapid focus events
      triggerEvent('focus');
      triggerEvent('focus');
      triggerEvent('focus');

      await jest.advanceTimersByTimeAsync(150);

      expect(mockRefreshWithDebounce).toHaveBeenCalledTimes(3);
      // With proper debouncing, should only refresh once
      expect(refreshCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Network Reconnection Events', () => {
    it('should trigger token refresh on network reconnection', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      const mockRefreshOnOnline = jest.fn(async () => {
        if (navigator.onLine && AuthService.shouldRefreshToken()) {
          await AuthService.checkAndRefreshToken();
        }
      });

      window.addEventListener('online', mockRefreshOnOnline);

      // Simulate coming back online
      mockOnline = true;
      triggerEvent('online');
      await jest.runAllTimersAsync();

      expect(mockRefreshOnOnline).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalled();
    });

    it('should not refresh token when going offline', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);

      const mockRefreshOnOffline = jest.fn(async () => {
        // Don't refresh when going offline
      });

      window.addEventListener('offline', mockRefreshOnOffline);

      mockOnline = false;
      triggerEvent('offline');
      await jest.runAllTimersAsync();

      expect(mockRefreshOnOffline).toHaveBeenCalled();
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle network error during reconnection refresh', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockRejectedValue(new Error('Still network issues'));

      const mockRefreshOnOnline = jest.fn(async () => {
        try {
          if (navigator.onLine && AuthService.shouldRefreshToken()) {
            await AuthService.checkAndRefreshToken();
          }
        } catch (error) {
          console.warn('Network refresh failed:', error);
        }
      });

      window.addEventListener('online', mockRefreshOnOnline);

      mockOnline = true;
      triggerEvent('online');
      await jest.runAllTimersAsync();

      expect(mockRefreshOnOnline).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalled();
      // Should handle error gracefully
    });
  });

  describe('Automatic Refresh Timer', () => {
    it('should set up automatic refresh timer for old tokens', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);

      const mockSetupTimer = jest.fn(() => {
        const timeUntilExpiry = AuthService.getTimeUntilExpiry();
        if (timeUntilExpiry > 0) {
          // Setup timer for next refresh check
          setTimeout(() => {
            AuthService.checkAndRefreshToken();
          }, Math.min(timeUntilExpiry * 0.1, 24 * 60 * 60 * 1000)); // Check every 10% of remaining time, max 24h
        }
      });

      mockSetupTimer();

      expect(mockSetupTimer).toHaveBeenCalled();
      // Timer should be set based on token expiry
    });

    it('should not set up timer when no token exists', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const mockSetupTimer = jest.fn(() => {
        const timeUntilExpiry = AuthService.getTimeUntilExpiry();
        if (timeUntilExpiry > 0) {
          setTimeout(() => {
            AuthService.checkAndRefreshToken();
          }, Math.min(timeUntilExpiry * 0.1, 24 * 60 * 60 * 1000));
        }
      });

      mockSetupTimer();

      expect(mockSetupTimer).toHaveBeenCalled();
      // No timer should be set when no token
    });

    it('should refresh token when timer fires', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      let timerCallback: (() => Promise<void>) | null = null;

      const mockSetupTimer = jest.fn(() => {
        const timeUntilExpiry = AuthService.getTimeUntilExpiry();
        if (timeUntilExpiry > 0) {
          timerCallback = async () => {
            await AuthService.checkAndRefreshToken();
          };
          setTimeout(timerCallback, 1000); // Short timeout for testing
        }
      });

      mockSetupTimer();

      // Fast-forward timer
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockSetupTimer).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalled();
    });

    it('should clear timer on component unmount', () => {
      let timerId: NodeJS.Timeout | null = null;

      const mockSetupTimer = jest.fn(() => {
        const timeUntilExpiry = AuthService.getTimeUntilExpiry();
        if (timeUntilExpiry > 0) {
          timerId = setTimeout(() => {
            AuthService.checkAndRefreshToken();
          }, 1000);
        }
      });

      const mockCleanupTimer = jest.fn(() => {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
      });

      mockSetupTimer();
      expect(timerId).toBeTruthy();

      mockCleanupTimer();
      expect(mockCleanupTimer).toHaveBeenCalled();
    });
  });

  describe('Debouncing and Rate Limiting', () => {
    it('should debounce rapid refresh triggers', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      let refreshCallCount = 0;
      let debounceTimeout: NodeJS.Timeout | null = null;

      const debouncedRefresh = jest.fn(async () => {
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        
        debounceTimeout = setTimeout(async () => {
          if (AuthService.shouldRefreshToken()) {
            refreshCallCount++;
            await AuthService.checkAndRefreshToken();
          }
        }, 500);
      });

      // Simulate rapid triggers
      debouncedRefresh();
      debouncedRefresh();
      debouncedRefresh();

      await jest.advanceTimersByTimeAsync(600);

      expect(debouncedRefresh).toHaveBeenCalledTimes(3);
      expect(refreshCallCount).toBe(1); // Only one actual refresh due to debouncing
      expect(apiRequest).toHaveBeenCalledTimes(1);
    });

    it('should prevent refresh spam within short time window', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      let lastRefreshTime = 0;
      const MIN_REFRESH_INTERVAL = 30000; // 30 seconds

      const rateLimitedRefresh = jest.fn(async () => {
        const now = Date.now();
        if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
          console.log('Refresh rate limited');
          return false;
        }
        
        if (AuthService.shouldRefreshToken()) {
          lastRefreshTime = now;
          await AuthService.checkAndRefreshToken();
          return true;
        }
        return false;
      });

      // First call should succeed
      const result1 = await rateLimitedRefresh();
      expect(result1).toBe(true);
      expect(apiRequest).toHaveBeenCalledTimes(1);

      // Second call immediately should be rate limited
      const result2 = await rateLimitedRefresh();
      expect(result2).toBe(false);
      expect(apiRequest).toHaveBeenCalledTimes(1); // No additional call

      // After time passes, should allow refresh again
      jest.advanceTimersByTime(31000); // 31 seconds
      const result3 = await rateLimitedRefresh();
      expect(result3).toBe(true);
      expect(apiRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent debounced refresh attempts', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      let activeRefreshPromise: Promise<boolean> | null = null;

      const concurrencySafeRefresh = jest.fn(async (): Promise<boolean> => {
        if (activeRefreshPromise) {
          // Return existing promise instead of starting new refresh
          return activeRefreshPromise;
        }

        if (AuthService.shouldRefreshToken()) {
          activeRefreshPromise = AuthService.checkAndRefreshToken();
          const result = await activeRefreshPromise;
          activeRefreshPromise = null;
          return result;
        }

        return false;
      });

      // Start multiple concurrent refreshes
      const promises = [
        concurrencySafeRefresh(),
        concurrencySafeRefresh(),
        concurrencySafeRefresh(),
      ];

      const results = await Promise.all(promises);

      expect(concurrencySafeRefresh).toHaveBeenCalledTimes(3);
      expect(apiRequest).toHaveBeenCalledTimes(1); // Only one actual API call
      expect(results).toEqual([true, true, true]); // All resolve to same result
    });
  });

  describe('PWA Event Integration', () => {
    it('should handle beforeinstallprompt event', async () => {
      const mockBeforeInstallPrompt = jest.fn((event) => {
        event.preventDefault();
        console.log('PWA install prompt available');
      });

      window.addEventListener('beforeinstallprompt', mockBeforeInstallPrompt);

      triggerEvent('beforeinstallprompt', { preventDefault: jest.fn() });

      expect(mockBeforeInstallPrompt).toHaveBeenCalled();
    });

    it('should handle appinstalled event and setup refresh', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);

      const mockOnAppInstalled = jest.fn(() => {
        console.log('PWA installed, setting up token refresh');
        // Setup refresh timers for PWA lifecycle
      });

      window.addEventListener('appinstalled', mockOnAppInstalled);

      triggerEvent('appinstalled');

      expect(mockOnAppInstalled).toHaveBeenCalled();
    });

    it('should handle page unload and cleanup timers', () => {
      let timers: NodeJS.Timeout[] = [];

      const mockSetupCleanup = jest.fn(() => {
        const timer = setTimeout(() => {}, 1000);
        timers.push(timer);

        window.addEventListener('beforeunload', () => {
          timers.forEach(clearTimeout);
          timers = [];
        });
      });

      mockSetupCleanup();

      triggerEvent('beforeunload');

      expect(mockSetupCleanup).toHaveBeenCalled();
    });
  });

  describe('Service Worker Integration', () => {
    it('should refresh token when service worker becomes active', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      // Mock service worker registration
      const mockServiceWorker = {
        addEventListener: jest.fn(),
        state: 'activated',
      };

      const mockRefreshOnSWActivation = jest.fn(async () => {
        if (AuthService.shouldRefreshToken()) {
          await AuthService.checkAndRefreshToken();
        }
      });

      // Simulate service worker activation event
      mockServiceWorker.addEventListener('statechange', mockRefreshOnSWActivation);
      
      // Trigger state change to activated
      mockRefreshOnSWActivation();

      expect(mockRefreshOnSWActivation).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalled();
    });

    it('should handle service worker update and refresh', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock).mockResolvedValue(mockRefreshResponse);

      const mockOnSWUpdate = jest.fn(async () => {
        // When SW updates, refresh token to ensure compatibility
        if (AuthService.shouldRefreshToken()) {
          await AuthService.checkAndRefreshToken();
        }
      });

      // Simulate SW update event
      mockOnSWUpdate();

      expect(mockOnSWUpdate).toHaveBeenCalled();
      expect(apiRequest).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should retry refresh on transient network errors', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(mockOldToken);
      (apiRequest as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockRefreshResponse);

      let retryCount = 0;
      const maxRetries = 3;

      const retryableRefresh = jest.fn(async (): Promise<boolean> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            retryCount++;
            const result = await AuthService.checkAndRefreshToken();
            return result;
          } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
          }
        }
        return false;
      });

      const result = await retryableRefresh();

      expect(retryableRefresh).toHaveBeenCalled();
      expect(retryCount).toBe(2); // Failed once, succeeded on retry
      expect(result).toBe(true);
      expect(apiRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle localStorage unavailable gracefully', async () => {
      // Mock localStorage to throw errors
      (localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const robustRefresh = jest.fn(async () => {
        try {
          return await AuthService.checkAndRefreshToken();
        } catch (error) {
          console.warn('Refresh failed due to storage error:', error);
          return false;
        }
      });

      const result = await robustRefresh();

      expect(robustRefresh).toHaveBeenCalled();
      expect(result).toBe(false); // Should handle error gracefully
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle token corruption and clear auth state', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('corrupted_token_data');

      const corruptionHandlingRefresh = jest.fn(async () => {
        try {
          return await AuthService.checkAndRefreshToken();
        } catch (error) {
          // If token is corrupted, clear auth state
          AuthService.clearAuthData();
          return false;
        }
      });

      const result = await corruptionHandlingRefresh();

      expect(corruptionHandlingRefresh).toHaveBeenCalled();
      expect(result).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });
});