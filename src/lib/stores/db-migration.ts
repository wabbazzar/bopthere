/**
 * One-time migration of ALL localStorage data to IndexedDB.
 *
 * Reads every known hw-* key, writes to the appropriate IndexedDB
 * object store, then removes the localStorage entries.
 *
 * The migration flag itself lives in localStorage so it's shared
 * across tabs and prevents re-running.
 */

import { openDatabase } from './db';

const MIGRATION_FLAG = 'hw-idb-migration-complete';

export interface MigrationResult {
	migrated: boolean;
	keysProcessed: number;
	message: string;
}

export async function migrateLocalStorageToIndexedDB(): Promise<MigrationResult> {
	if (typeof localStorage === 'undefined') {
		return { migrated: false, keysProcessed: 0, message: 'Not in browser' };
	}

	if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
		return { migrated: false, keysProcessed: 0, message: 'Already migrated' };
	}

	const database = await openDatabase();
	if (!database) {
		return { migrated: false, keysProcessed: 0, message: 'IndexedDB unavailable' };
	}

	let keysProcessed = 0;

	try {
		// ── Auth ──
		const token = localStorage.getItem('hw-auth-token');
		if (token) {
			await putRow(database, 'auth', 'token', token);
			keysProcessed++;
		}
		const userRaw = localStorage.getItem('hw-auth-user');
		if (userRaw) {
			try {
				await putRow(database, 'auth', 'user', JSON.parse(userRaw));
				keysProcessed++;
			} catch {
				// Malformed JSON — skip, don't block migration
			}
		}

		// ── Trips ──
		const tripsRaw = localStorage.getItem('hw-trips');
		if (tripsRaw) {
			try {
				const trips = JSON.parse(tripsRaw) as Record<string, unknown>;
				for (const [tripId, trip] of Object.entries(trips)) {
					await putRow(database, 'trips', tripId, trip);
				}
				keysProcessed++;
			} catch {
				// Malformed JSON — skip
			}
		}

		// ── Meta keys (sync timestamps) ──
		for (const metaKey of ['hw-trips-meta', 'hw-journal-meta', 'hw-todos-meta']) {
			const raw = localStorage.getItem(metaKey);
			if (raw) {
				try {
					await putRow(database, 'meta', metaKey, JSON.parse(raw));
					keysProcessed++;
				} catch {
					// skip malformed
				}
			}
		}

		// ── Sync pending ──
		const syncPending = localStorage.getItem('hw-trips-sync-pending');
		if (syncPending) {
			await putRow(database, 'meta', 'hw-trips-sync-pending', syncPending);
			keysProcessed++;
		}

		// ── Schema version ──
		const schemaVersion = localStorage.getItem('hw-todos-schema-version');
		if (schemaVersion) {
			await putRow(database, 'meta', 'hw-todos-schema-version', schemaVersion);
			keysProcessed++;
		}

		// ── Journal entries (per-trip) ──
		const journalKeys = collectKeys('hw-journal-', ['hw-journal-meta']);
		for (const k of journalKeys) {
			const tripId = k.replace('hw-journal-', '');
			const raw = localStorage.getItem(k);
			if (raw) {
				try {
					await putRow(database, 'journal', tripId, JSON.parse(raw));
					keysProcessed++;
				} catch {
					// skip malformed
				}
			}
		}

		// ── Todos (per-trip) ──
		const todoKeys = collectKeys('hw-trip-todos-');
		for (const k of todoKeys) {
			const tripId = k.replace('hw-trip-todos-', '');
			const raw = localStorage.getItem(k);
			if (raw) {
				try {
					await putRow(database, 'todos', tripId, JSON.parse(raw));
					keysProcessed++;
				} catch {
					// skip malformed
				}
			}
		}

		// ── UI Preferences ──
		const lastPath = localStorage.getItem('hw-last-path');
		if (lastPath) {
			await putRow(database, 'prefs', 'hw-last-path', lastPath);
			keysProcessed++;
		}

		const prefKeys = collectKeys('hw-trip-day-').concat(collectKeys('hw-trip-view-'));
		for (const k of prefKeys) {
			const raw = localStorage.getItem(k);
			if (raw) {
				await putRow(database, 'prefs', k, raw);
				keysProcessed++;
			}
		}

		// ── Clean up localStorage ──
		const allHwKeys = collectKeys('hw-');
		for (const k of allHwKeys) {
			localStorage.removeItem(k);
		}

		// Mark migration complete
		localStorage.setItem(MIGRATION_FLAG, 'true');

		return { migrated: true, keysProcessed, message: `Migrated ${keysProcessed} keys` };
	} catch (e) {
		// Migration failed — do NOT remove localStorage keys so data is not lost.
		return {
			migrated: false,
			keysProcessed,
			message: `Migration failed: ${e instanceof Error ? e.message : 'Unknown error'}`
		};
	}
}

/** Collect all localStorage keys matching a prefix, optionally excluding specific keys. */
function collectKeys(prefix: string, exclude: string[] = []): string[] {
	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (k && k.startsWith(prefix) && !exclude.includes(k)) {
			keys.push(k);
		}
	}
	return keys;
}

function putRow(database: IDBDatabase, storeName: string, key: string, value: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = database.transaction(storeName, 'readwrite');
		tx.objectStore(storeName).put({ key, value });
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
