/**
 * IndexedDB blob cache for journal photos.
 *
 * Photos are fetched once from the server via signed URL, then the raw
 * image blob is stored locally. Subsequent renders use the cached blob
 * (converted to an object URL) — no network request needed.
 *
 * Separate IDB database from the main hw-travel DB to avoid version
 * bumps and keep large blobs out of the primary data store.
 */

const DB_NAME = 'hw-photo-cache';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

/** In-memory map of filename → active object URL (avoids creating duplicates). */
const objectUrls = new Map<string, string>();

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error('IndexedDB not available'));
			return;
		}
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/**
 * Get a cached photo blob as an object URL, or null if not cached.
 */
export async function getCachedPhotoUrl(tripId: string, filename: string): Promise<string | null> {
	const key = `${tripId}/${filename}`;

	// Check in-memory first
	const existing = objectUrls.get(key);
	if (existing) return existing;

	try {
		const db = await openDB();
		const blob: Blob | undefined = await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const req = tx.objectStore(STORE_NAME).get(key);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});

		if (!blob) return null;

		const url = URL.createObjectURL(blob);
		objectUrls.set(key, url);
		return url;
	} catch {
		return null;
	}
}

/**
 * Fetch a photo from a signed URL, cache the blob in IndexedDB,
 * and return an object URL for immediate display.
 */
export async function fetchAndCachePhoto(tripId: string, filename: string, signedUrl: string): Promise<string> {
	const key = `${tripId}/${filename}`;

	const res = await fetch(signedUrl);
	if (!res.ok) throw new Error(`Photo fetch failed (${res.status})`);
	const blob = await res.blob();

	// Store in IndexedDB (fire-and-forget)
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put(blob, key);
	} catch {
		// Cache write failed — still return the blob URL
	}

	const url = URL.createObjectURL(blob);
	objectUrls.set(key, url);
	return url;
}

/**
 * Remove a cached photo (e.g., when deleted from journal).
 */
export async function removeCachedPhoto(tripId: string, filename: string): Promise<void> {
	const key = `${tripId}/${filename}`;

	const existing = objectUrls.get(key);
	if (existing) {
		URL.revokeObjectURL(existing);
		objectUrls.delete(key);
	}

	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).delete(key);
	} catch {
		// Ignore
	}
}
