import { useEffect, useRef, useCallback } from 'react';
import { AuthService } from '@/lib/auth';

interface UseTokenRefreshOptions {
  onRefreshSuccess?: () => void;
  onRefreshError?: (error: Error) => void;
  refreshThreshold?: number; // Percentage of token lifetime (0-1)
  verifyToken?: () => Promise<void>; // Optional verify function
}

/**
 * Custom hook for managing automatic token refresh
 * Handles PWA lifecycle events and provides manual refresh capability
 */
export function useTokenRefresh(options: UseTokenRefreshOptions = {}) {
  const { 
    onRefreshSuccess, 
    onRefreshError,
    refreshThreshold = 0.8, // Default to 80% of token lifetime
    verifyToken
  } = options;
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);

  /**
   * Perform token refresh with debouncing
   */
  const performRefresh = useCallback(async () => {
    // Prevent concurrent refreshes
    if (isRefreshingRef.current) {
      console.log('Token refresh already in progress, skipping...');
      return false;
    }

    // Debounce refreshes (minimum 5 seconds between attempts)
    const now = Date.now();
    if (now - lastRefreshRef.current < 5000) {
      console.log('Token refresh attempted too soon, skipping...');
      return false;
    }

    try {
      isRefreshingRef.current = true;
      lastRefreshRef.current = now;
      
      console.log('Performing token refresh...');
      const response = await AuthService.refreshToken();
      
      console.log('Token refresh successful');
      onRefreshSuccess?.();
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      onRefreshError?.(error as Error);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [onRefreshSuccess, onRefreshError]);

  /**
   * Check if token needs refresh and perform it if necessary
   */
  const checkAndRefresh = useCallback(async () => {
    if (AuthService.shouldRefreshToken()) {
      return performRefresh();
    }
    return false;
  }, [performRefresh]);

  /**
   * Set up automatic refresh timer
   */
  const setupRefreshTimer = useCallback(() => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const token = AuthService.getToken();
    if (!token) {
      return;
    }

    // Calculate time until refresh is needed
    const timeUntilExpiry = AuthService.getTimeUntilExpiry();
    const timeUntilRefresh = timeUntilExpiry * refreshThreshold;

    if (timeUntilRefresh > 0) {
      const hoursUntilRefresh = timeUntilRefresh / 1000 / 60 / 60;
      console.log(`Setting token refresh timer for ${hoursUntilRefresh.toFixed(1)} hours`);
      
      refreshTimerRef.current = setTimeout(async () => {
        console.log('Timer triggered, refreshing token...');
        const success = await performRefresh();
        
        if (success) {
          // Set up the next refresh timer
          setupRefreshTimer();
        }
      }, timeUntilRefresh);
    }
  }, [performRefresh, refreshThreshold]);

  /**
   * Handle app becoming visible (PWA returning from background)
   */
  const handleAppVisible = useCallback(async () => {
    const token = AuthService.getToken();
    if (!token) return;

    console.log('App became visible, checking if token needs refresh...');
    
    // Always check token validity when app becomes visible
    const needsRefresh = AuthService.shouldRefreshToken();
    
    if (needsRefresh) {
      console.log('Token needs refresh after app became visible');
      const success = await performRefresh();
      
      if (success) {
        setupRefreshTimer();
      }
    } else {
      // Even if we don't need refresh, verify the token is still valid
      if (verifyToken) {
        try {
          await verifyToken();
          console.log('Token still valid after app became visible');
        } catch (error) {
          console.error('Token verification failed after app became visible:', error);
          // Try to refresh as a fallback
          await performRefresh();
        }
      } else {
        // If no verifyToken function provided, use AuthService directly
        try {
          await AuthService.verifyToken();
          console.log('Token still valid after app became visible');
        } catch (error) {
          console.error('Token verification failed after app became visible:', error);
          // Try to refresh as a fallback
          await performRefresh();
        }
      }
    }
  }, [performRefresh, setupRefreshTimer, verifyToken]);

  /**
   * Handle network reconnection
   */
  const handleNetworkReconnect = useCallback(async () => {
    const token = AuthService.getToken();
    if (!token) return;

    console.log('Network reconnected, checking token...');
    
    // After network reconnection, always try to refresh if needed
    const success = await checkAndRefresh();
    
    if (success) {
      setupRefreshTimer();
    }
  }, [checkAndRefresh, setupRefreshTimer]);

  // Set up event listeners and timer
  useEffect(() => {
    // Initial setup
    setupRefreshTimer();

    // PWA lifecycle event handlers
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleAppVisible();
      }
    };

    const handleFocus = () => {
      // Additional check on window focus
      checkAndRefresh();
    };

    const handleOnline = () => {
      handleNetworkReconnect();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    // PWA detection and logging
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  ('standalone' in window.navigator && (window.navigator as unknown as { standalone?: boolean }).standalone);
    
    if (isPWA) {
      console.log('useTokenRefresh: Running in PWA mode with enhanced lifecycle handling');
    }

    // Cleanup
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [handleAppVisible, handleNetworkReconnect, checkAndRefresh, setupRefreshTimer]);

  return {
    refreshToken: performRefresh,
    checkAndRefresh,
    setupRefreshTimer,
    isRefreshing: isRefreshingRef.current,
  };
}