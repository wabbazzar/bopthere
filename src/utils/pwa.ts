import { CharacterType } from '../types/character';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
}

interface CharacterManifest {
  name: string;
  short_name: string;
  theme_color: string;
  background_color: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
}

const characterManifests: Record<CharacterType, CharacterManifest> = {
  wesley: {
    name: "Heather & Wesley",
    short_name: "Heather & Wesley",
    theme_color: "#0088CC",
    background_color: "#001F3F",
    icons: [
      {
        src: "/app-uploads/hwapp.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/app-uploads/hwapp.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  },
  heather: {
    name: "Heather & Wesley",
    short_name: "Heather & Wesley",
    theme_color: "#FFB6C1",
    background_color: "#2C1810",
    icons: [
      {
        src: "/app-uploads/hwapp.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/app-uploads/hwapp.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  },
  puffy: {
    name: "Heather & Wesley",
    short_name: "Heather & Wesley",
    theme_color: "#9370DB",
    background_color: "#1E0033",
    icons: [
      {
        src: "/app-uploads/hwapp.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/app-uploads/hwapp.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  }
};

export class PWAManager {
  private state: PWAState = {
    isInstallable: false,
    isInstalled: false,
    isOffline: !navigator.onLine,
    deferredPrompt: null
  };

  private listeners: Array<(state: PWAState) => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.state.isInstalled = true;
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.state.deferredPrompt = e as BeforeInstallPromptEvent;
      this.state.isInstallable = true;
      this.notifyListeners();
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      this.state.isInstalled = true;
      this.state.isInstallable = false;
      this.state.deferredPrompt = null;
      this.notifyListeners();
    });

    // Listen for online/offline
    window.addEventListener('online', () => {
      this.state.isOffline = false;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.state.isOffline = true;
      this.notifyListeners();
    });
  }

  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                this.notifyUpdateAvailable();
              }
            });
          }
        });

        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
      }
    }
    return null;
  }

  public async updateManifestForCharacter(character: CharacterType): Promise<void> {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;

    try {
      // Fetch current manifest
      const response = await fetch('/manifest.json');
      const baseManifest = await response.json();

      // Merge with character-specific data
      const characterData = characterManifests[character];
      const updatedManifest = {
        ...baseManifest,
        ...characterData
      };

      // Create blob URL for updated manifest
      const blob = new Blob([JSON.stringify(updatedManifest)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Update manifest link
      manifestLink.setAttribute('href', url);

      // Update theme color meta tag
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', characterData.theme_color);
      }
    } catch (error) {
      console.error('Failed to update manifest:', error);
    }
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.state.deferredPrompt) {
      return false;
    }

    try {
      await this.state.deferredPrompt.prompt();
      const { outcome } = await this.state.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        return true;
      } else {
        console.log('User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('Install prompt error:', error);
      return false;
    }
  }

  public subscribe(listener: (state: PWAState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state); // Call immediately with current state

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getState(): PWAState {
    return { ...this.state };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  private notifyUpdateAvailable() {
    // You can implement a custom notification here
    console.log('New version available! Reload to update.');
  }

  public async skipWaiting(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }
}

// Create singleton instance
export const pwaManager = new PWAManager();

// Export types
export type { PWAState, BeforeInstallPromptEvent, CharacterManifest };