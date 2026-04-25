/**
 * IndexedDB persistence layer for H&W Travel.
 *
 * Single database "hw-travel" with 6 object stores.
 * Follows Shredly2 patterns: singleton connection, SSR-safe,
 * cached db reference with onclose/onversionchange handlers.
 */

const DB_NAME = 'hw-travel';
const DB_VERSION = 2;

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

let db: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Open (or return cached) the hw-travel IndexedDB database.
 * Returns null during SSR or if IndexedDB is unavailable.
 */
export async function openDatabase(): Promise<IDBDatabase | null> {
	if (!isBrowser) return null;
	if (db) return db;
	if (dbOpenPromise) return dbOpenPromise;

	dbOpenPromise = new Promise<IDBDatabase | null>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			console.error('[HW-DB] Failed to open database:', request.error);
			dbOpenPromise = null;
			reject(request.error);
		};

		request.onsuccess = () => {
			db = request.result;

			db.onclose = () => {
				db = null;
				dbOpenPromise = null;
			};

			db.onversionchange = () => {
				db?.close();
				db = null;
				dbOpenPromise = null;
			};

			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;
			const stores = ['auth', 'trips', 'journal', 'todos', 'meta', 'prefs', 'scripts'] as const;
			for (const name of stores) {
				if (!database.objectStoreNames.contains(name)) {
					database.createObjectStore(name, { keyPath: 'key' });
				}
			}
		};
	});

	return dbOpenPromise;
}

// ── Generic CRUD helpers ──────────────────────────────────────

export async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
	const database = await openDatabase();
	if (!database) return undefined;

	return new Promise((resolve, reject) => {
		const tx = database.transaction(storeName, 'readonly');
		const req = tx.objectStore(storeName).get(key);
		req.onsuccess = () => resolve(req.result?.value as T | undefined);
		req.onerror = () => reject(req.error);
	});
}

export async function dbPut(storeName: string, key: string, value: unknown): Promise<void> {
	const database = await openDatabase();
	if (!database) return;

	return new Promise((resolve, reject) => {
		const tx = database.transaction(storeName, 'readwrite');
		tx.objectStore(storeName).put({ key, value });
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
	const database = await openDatabase();
	if (!database) return;

	return new Promise((resolve, reject) => {
		const tx = database.transaction(storeName, 'readwrite');
		tx.objectStore(storeName).delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function dbGetAll<T>(storeName: string): Promise<Array<{ key: string; value: T }>> {
	const database = await openDatabase();
	if (!database) return [];

	return new Promise((resolve, reject) => {
		const tx = database.transaction(storeName, 'readonly');
		const req = tx.objectStore(storeName).getAll();
		req.onsuccess = () => resolve(req.result ?? []);
		req.onerror = () => reject(req.error);
	});
}

export async function dbClearStore(storeName: string): Promise<void> {
	const database = await openDatabase();
	if (!database) return;

	return new Promise((resolve, reject) => {
		const tx = database.transaction(storeName, 'readwrite');
		const req = tx.objectStore(storeName).clear();
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

export function closeDatabase(): void {
	if (db) {
		db.close();
		db = null;
		dbOpenPromise = null;
	}
}
