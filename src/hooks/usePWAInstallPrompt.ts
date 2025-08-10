import { useState, useEffect, useRef, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface UsePWAInstallPromptOptions {
  /** Delay in ms before showing prompt to new users */
  delayMs?: number;
  /** Storage key for tracking user IP/visits */
  storageKey?: string;
  /** Minimum time between prompts for same user */
  cooldownDays?: number;
}

/**
 * Custom hook for PWA installation prompts
 * Detects mobile users, tracks new IPs, and manages install prompts
 */
export function usePWAInstallPrompt(options: UsePWAInstallPromptOptions = {}) {
  const {
    delayMs = 3000,
    storageKey = 'hw-pwa-install-data',
    cooldownDays = 30
  } = options;

  const [canInstall, setCanInstall] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [userIP, setUserIP] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const promptShownRef = useRef(false);

  /**
   * Detect if user is on mobile device
   */
  const detectMobile = (): boolean => {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'mobile', 'tablet'];
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // Also check screen size as backup
    const isMobileScreen = window.innerWidth <= 768;
    
    // Check for touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    return isMobileUA || (isMobileScreen && hasTouch);
  };

  /**
   * Get user's IP address (approximate)
   */
  const getUserIP = async (): Promise<string | null> => {
    try {
      // Use a simple method to get approximate location/IP info
      // This is just for tracking new users, doesn't need to be perfect
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || null;
    } catch (error) {
      console.log('Could not get IP for install prompt tracking:', error);
      // Fallback to browser fingerprinting
      return `${navigator.userAgent.slice(0, 20)}-${screen.width}x${screen.height}`;
    }
  };

  /**
   * Check if user is new based on stored data
   */
  const checkIfNewUser = useCallback((ip: string): boolean => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return true;

      const data = JSON.parse(stored);
      const now = Date.now();
      
      // Check if this IP has been seen before
      if (data.visitedIPs && data.visitedIPs.includes(ip)) {
        // Check if enough time has passed for re-prompting
        const lastPrompt = data.lastPromptTime || 0;
        const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
        
        return now - lastPrompt > cooldownMs;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking new user status:', error);
      return true;
    }
  }, [storageKey, cooldownDays]);

  /**
   * Record that user was prompted
   */
  const recordPromptShown = useCallback((ip: string, action: 'shown' | 'accepted' | 'dismissed') => {
    try {
      const stored = localStorage.getItem(storageKey);
      const data = stored ? JSON.parse(stored) : {};
      
      if (!data.visitedIPs) data.visitedIPs = [];
      if (!data.visitedIPs.includes(ip)) {
        data.visitedIPs.push(ip);
      }
      
      data.lastPromptTime = Date.now();
      data.lastAction = action;
      
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error recording prompt data:', error);
    }
  }, [storageKey]);

  /**
   * Show the install prompt
   */
  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPromptRef.current || isInstalling) return false;

    try {
      setIsInstalling(true);
      
      // Show the browser's install prompt
      await deferredPromptRef.current.prompt();
      
      // Wait for user choice
      const choiceResult = await deferredPromptRef.current.userChoice;
      
      const accepted = choiceResult.outcome === 'accepted';
      
      if (userIP) {
        recordPromptShown(userIP, accepted ? 'accepted' : 'dismissed');
      }
      
      if (accepted) {
        console.log('PWA install accepted');
        setShowPrompt(false);
        setCanInstall(false);
      } else {
        console.log('PWA install dismissed');
        setShowPrompt(false);
      }
      
      // Clear the deferred prompt
      deferredPromptRef.current = null;
      
      return accepted;
    } catch (error) {
      console.error('Error during PWA install:', error);
      return false;
    } finally {
      setIsInstalling(false);
    }
  };

  /**
   * Dismiss the prompt modal
   */
  const dismissPrompt = () => {
    setShowPrompt(false);
    if (userIP) {
      recordPromptShown(userIP, 'dismissed');
    }
  };

  // Initialize mobile detection and IP tracking
  useEffect(() => {
    const initializePrompt = async () => {
      // Check if already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           ('standalone' in window.navigator && 
                            (window.navigator as unknown as { standalone?: boolean }).standalone);
      
      if (isStandalone) {
        console.log('PWA already installed');
        return;
      }

      // Detect mobile
      const mobile = detectMobile();
      setIsMobile(mobile);
      
      if (!mobile) {
        console.log('Not on mobile, skipping PWA install prompt');
        return;
      }

      // Get user IP
      const ip = await getUserIP();
      setUserIP(ip);
      
      if (!ip) {
        console.log('Could not determine user identity for PWA prompt');
        return;
      }

      // Check if new user
      const isNew = checkIfNewUser(ip);
      setIsNewUser(isNew);
      
      console.log(`PWA Install Prompt: Mobile=${mobile}, IP=${ip.slice(0, 10)}..., New=${isNew}`);
    };

    initializePrompt();
  }, [checkIfNewUser]);

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      
      // Prevent the mini-infobar from appearing
      e.preventDefault();
      
      // Store the event for later use
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      
      // Show prompt if conditions are met
      if (isMobile && isNewUser && !promptShownRef.current) {
        promptShownRef.current = true;
        
        // Delay showing the prompt slightly
        setTimeout(() => {
          setShowPrompt(true);
          if (userIP) {
            recordPromptShown(userIP, 'shown');
          }
        }, delayMs);
      }
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setCanInstall(false);
      setShowPrompt(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isMobile, isNewUser, userIP, delayMs, recordPromptShown]);

  return {
    canInstall,
    showPrompt,
    isInstalling,
    isMobile,
    isNewUser,
    promptInstall,
    dismissPrompt,
  };
}