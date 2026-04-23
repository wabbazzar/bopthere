/**
 * IndexedDB-backed offline upload queue for journal photos.
 * When a photo upload fails (offline), the file blob is stored here
 * and retried when connectivity returns.
 */

import { uploadPhoto } from '$lib/services/photo-upload';
import { journalStore } from '$lib/stores/journal';

const DB_NAME = 'hw-photo-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending-uploads';

interface PendingUpload {
	blockId: string;
	tripId: string;
	dayIndex: number;
	blob: Blob;
	filename: string;
	createdAt: string;
}

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
				db.createObjectStore(STORE_NAME, { keyPath: 'blockId' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** Queue a failed upload for retry later. */
export async function queueUpload(
	tripId: string,
	dayIndex: number,
	blockId: string,
	file: File
): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put({
			blockId,
			tripId,
			dayIndex,
			blob: file,
			filename: file.name,
			createdAt: new Date().toISOString()
		} satisfies PendingUpload);
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch {
		// IndexedDB not available (private browsing) — silently fail
	}
}

/** Process all pending uploads. Call on app init and on reconnect. */
export async function processQueue(): Promise<void> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);

		const items: PendingUpload[] = await new Promise((resolve, reject) => {
			const req = store.getAll();
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});

		for (const item of items) {
			try {
				const file = new File([item.blob], item.filename, { type: item.blob.type });
				const { filename } = await uploadPhoto(item.tripId, file);

				// Update the journal store with the real server filename
				journalStore.updatePhotoId(item.tripId, item.dayIndex, item.blockId, filename);

				// Remove from queue
				const deleteTx = db.transaction(STORE_NAME, 'readwrite');
				deleteTx.objectStore(STORE_NAME).delete(item.blockId);
			} catch {
				// Still offline or server error — leave in queue for next attempt
			}
		}
	} catch {
		// IndexedDB not available
	}
}

/** Retry a single pending upload by blockId. */
export async function retryUpload(blockId: string): Promise<boolean> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);

		const item: PendingUpload | undefined = await new Promise((resolve, reject) => {
			const req = store.get(blockId);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});

		if (!item) return false;

		const file = new File([item.blob], item.filename, { type: item.blob.type });
		const { filename } = await uploadPhoto(item.tripId, file);

		journalStore.updatePhotoId(item.tripId, item.dayIndex, item.blockId, filename);

		const deleteTx = db.transaction(STORE_NAME, 'readwrite');
		deleteTx.objectStore(STORE_NAME).delete(blockId);
		return true;
	} catch {
		return false;
	}
}

/** Get count of pending uploads. */
export async function getPendingCount(): Promise<number> {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		return new Promise((resolve, reject) => {
			const req = store.count();
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	} catch {
		return 0;
	}
}

/** Initialize the queue: process pending uploads and listen for online events. */
export function initPhotoQueue(): void {
	if (typeof window === 'undefined') return;

	// Process any pending uploads on startup
	processQueue();

	// Retry when coming back online
	window.addEventListener('online', () => {
		processQueue();
	});
}
