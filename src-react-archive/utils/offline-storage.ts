interface PendingRSVP {
  id: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  characterContext?: string;
}

interface OfflineData {
  rsvpResponses: PendingRSVP[];
  lastSync: number;
}

class OfflineStorageManager {
  private dbName = 'wedding-app-db';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('pending-rsvp')) {
          const rsvpStore = db.createObjectStore('pending-rsvp', { keyPath: 'id' });
          rsvpStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('cached-data')) {
          db.createObjectStore('cached-data', { keyPath: 'key' });
        }
      };
    });
  }

  async addPendingRSVP(
    payload: Record<string, unknown>,
    characterContext?: string
  ): Promise<string> {
    if (!this.db) await this.init();

    const id = `rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingRSVP: PendingRSVP = {
      id,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      characterContext,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-rsvp'], 'readwrite');
      const store = transaction.objectStore('pending-rsvp');
      const request = store.add(pendingRSVP);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingRSVPs(): Promise<PendingRSVP[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-rsvp'], 'readonly');
      const store = transaction.objectStore('pending-rsvp');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingRSVP(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-rsvp'], 'readwrite');
      const store = transaction.objectStore('pending-rsvp');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateRetryCount(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending-rsvp'], 'readwrite');
      const store = transaction.objectStore('pending-rsvp');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.retryCount += 1;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async cacheData(key: string, data: unknown): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached-data'], 'readwrite');
      const store = transaction.objectStore('cached-data');
      const request = store.put({ key, data, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedData(key: string): Promise<unknown | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached-data'], 'readonly');
      const store = transaction.objectStore('cached-data');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearExpiredData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;

    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached-data'], 'readwrite');
      const store = transaction.objectStore('cached-data');
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.timestamp < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getStorageStats(): Promise<{ pendingCount: number; cacheSize: number }> {
    if (!this.db) await this.init();

    const pendingRSVPs = await this.getPendingRSVPs();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached-data'], 'readonly');
      const store = transaction.objectStore('cached-data');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve({
          pendingCount: pendingRSVPs.length,
          cacheSize: request.result.length,
        });
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorageManager();
export type { PendingRSVP, OfflineData };
