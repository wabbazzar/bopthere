import { useState, useEffect, useCallback } from 'react';
import { offlineStorage, PendingRSVP } from '../utils/offline-storage';
import { useCharacter } from '../contexts/CharacterContext';
import { usePWA } from './usePWA';
import { RSVPService } from '@/integrations/aws/rsvp-service';
import type { RSVPRequest } from '@/integrations/aws/types';

interface RSVPData {
  name: string;
  email: string;
  attending: boolean;
  dietaryRestrictions?: string;
  plusOne?: boolean;
  plusOneName?: string;
  message?: string;
}

interface UseOfflineRSVPReturn {
  submitRSVP: (data: RSVPData) => Promise<{ success: boolean; offline?: boolean; id?: string }>;
  pendingSubmissions: PendingRSVP[];
  isOffline: boolean;
  syncPending: () => Promise<void>;
  clearPending: () => Promise<void>;
  storageStats: { pendingCount: number; cacheSize: number } | null;
}

export const useOfflineRSVP = (): UseOfflineRSVPReturn => {
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingRSVP[]>([]);
  const [storageStats, setStorageStats] = useState<{
    pendingCount: number;
    cacheSize: number;
  } | null>(null);
  const { selectedCharacter } = useCharacter();
  const { isOffline } = usePWA();

  const loadPendingSubmissions = useCallback(async () => {
    try {
      const pending = await offlineStorage.getPendingRSVPs();
      setPendingSubmissions(pending);

      const stats = await offlineStorage.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load pending submissions:', error);
    }
  }, []);

  useEffect(() => {
    loadPendingSubmissions();
  }, [loadPendingSubmissions]);

  const submitRSVPOnline = useCallback(
    async (data: RSVPData): Promise<boolean> => {
      try {
        const payload: RSVPRequest = {
          name: data.name,
          email: data.email,
          phone: undefined,
          attendance: data.attending ? 'yes' : 'no',
          notifications: undefined,
          dietary_restrictions: data.dietaryRestrictions,
          song_request: undefined,
          message_for_couple: data.message,
        };

        await RSVPService.submitRSVP(payload);
        return true;
      } catch (error) {
        console.error('Online RSVP submission failed:', error);
        return false;
      }
    },
    [selectedCharacter]
  );

  const submitRSVP = useCallback(
    async (data: RSVPData): Promise<{ success: boolean; offline?: boolean; id?: string }> => {
      // Try online submission first
      if (!isOffline) {
        const success = await submitRSVPOnline(data);
        if (success) {
          return { success: true };
        }
      }

      // Fall back to offline storage
      try {
        const id = await offlineStorage.addPendingRSVP(data, selectedCharacter);
        await loadPendingSubmissions();

        // Register for background sync if available
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
          const registration = await navigator.serviceWorker.ready;
          try {
            await registration.sync.register('sync-rsvp');
          } catch (syncError) {
            console.warn('Background sync registration failed:', syncError);
          }
        }

        return { success: true, offline: true, id };
      } catch (error) {
        console.error('Offline RSVP storage failed:', error);
        return { success: false };
      }
    },
    [isOffline, selectedCharacter, loadPendingSubmissions, submitRSVPOnline]
  );

  const syncPending = useCallback(async () => {
    const pending = await offlineStorage.getPendingRSVPs();

    for (const submission of pending) {
      try {
        const success = await submitRSVPOnline(submission.payload as RSVPData);

        if (success) {
          await offlineStorage.removePendingRSVP(submission.id);
        } else {
          // Increment retry count
          await offlineStorage.updateRetryCount(submission.id);
        }
      } catch (error) {
        console.error('Failed to sync RSVP:', submission.id, error);
        await offlineStorage.updateRetryCount(submission.id);
      }
    }

    await loadPendingSubmissions();
  }, [loadPendingSubmissions, submitRSVPOnline]);

  const clearPending = useCallback(async () => {
    const pending = await offlineStorage.getPendingRSVPs();

    for (const submission of pending) {
      await offlineStorage.removePendingRSVP(submission.id);
    }

    await loadPendingSubmissions();
  }, [loadPendingSubmissions]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOffline && pendingSubmissions.length > 0) {
      syncPending();
    }
  }, [isOffline, pendingSubmissions.length, syncPending]);

  return {
    submitRSVP,
    pendingSubmissions,
    isOffline: isOffline || false,
    syncPending,
    clearPending,
    storageStats,
  };
};
