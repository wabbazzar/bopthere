/**
 * IndexedDB helpers for Playwright E2E tests.
 *
 * The app uses a single IndexedDB database "hw-travel" (version 2)
 * with object stores: auth, trips, journal, todos, meta, prefs, scripts.
 * Each row has shape { key: string, value: T }.
 */
import type { Page } from '@playwright/test';

const DB_NAME = 'hw-travel';
const DB_VERSION = 2;

/**
 * Read a single value from an IndexedDB object store in the browser context.
 * Returns the `value` field of the row matching the given key, or null if not found.
 */
export async function idbGet(page: Page, storeName: string, key: string): Promise<any> {
	return page.evaluate(
		({ storeName, key, dbName, dbVersion }) => {
			return new Promise((resolve, reject) => {
				const req = indexedDB.open(dbName, dbVersion);
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					try {
						const tx = db.transaction(storeName, 'readonly');
						const store = tx.objectStore(storeName);
						const get = store.get(key);
						get.onsuccess = () => {
							const row = get.result;
							resolve(row ? row.value : null);
						};
						get.onerror = () => reject(get.error);
					} catch (e) {
						resolve(null);
					}
				};
				req.onupgradeneeded = () => {
					// DB doesn't exist yet or stores missing — return null
					req.result.close();
					resolve(null);
				};
			});
		},
		{ storeName, key, dbName: DB_NAME, dbVersion: DB_VERSION }
	);
}

/**
 * Write a value to an IndexedDB object store in the browser context.
 * Creates/overwrites the row with { key, value }.
 */
export async function idbPut(
	page: Page,
	storeName: string,
	key: string,
	value: any
): Promise<void> {
	await page.evaluate(
		({ storeName, key, value, dbName, dbVersion }) => {
			return new Promise<void>((resolve, reject) => {
				const req = indexedDB.open(dbName, dbVersion);
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					const tx = db.transaction(storeName, 'readwrite');
					const store = tx.objectStore(storeName);
					const put = store.put({ key, value });
					put.onsuccess = () => resolve();
					put.onerror = () => reject(put.error);
				};
				req.onupgradeneeded = (event) => {
					// Create stores if DB is being created for the first time
					const db = (event.target as IDBOpenDBRequest).result;
					const stores = ['auth', 'trips', 'journal', 'todos', 'meta', 'prefs', 'scripts'];
					for (const name of stores) {
						if (!db.objectStoreNames.contains(name)) {
							db.createObjectStore(name, { keyPath: 'key' });
						}
					}
				};
			});
		},
		{ storeName, key, value, dbName: DB_NAME, dbVersion: DB_VERSION }
	);
}

/**
 * Read all values from an IndexedDB object store.
 * Returns an object mapping key -> value.
 */
/** Get a specific day from the trips IDB store using the per-day key format. */
export async function idbGetTripDay(page: Page, tripId: string, dayIndex: number): Promise<any> {
	return idbGet(page, 'trips', `trip-day:${tripId}:${dayIndex}`);
}

/** Get trip metadata from the trips IDB store. */
export async function idbGetTripMeta(page: Page, tripId: string): Promise<any> {
	return idbGet(page, 'trips', `trip-meta:${tripId}`);
}

/** Count how many day rows are stored for a trip in IDB. */
export async function idbGetTripDayCount(page: Page, tripId: string): Promise<number> {
	const all = await idbGetAll(page, 'trips');
	return Object.keys(all).filter((k) => k.startsWith(`trip-day:${tripId}:`)).length;
}

/** Assemble all trips from per-row IDB entries into { tripId: { ...meta, days: [...] } }. */
export async function idbGetAllTrips(page: Page): Promise<Record<string, any>> {
	const all = await idbGetAll(page, 'trips');
	const trips: Record<string, any> = {};
	for (const [key, value] of Object.entries(all)) {
		if (key.startsWith('trip-meta:')) {
			const tripId = key.slice('trip-meta:'.length);
			trips[tripId] = { ...trips[tripId], ...(value as object) };
		} else if (key.startsWith('trip-day:')) {
			const rest = key.slice('trip-day:'.length);
			const lastColon = rest.lastIndexOf(':');
			const tripId = rest.slice(0, lastColon);
			const dayIndex = parseInt(rest.slice(lastColon + 1));
			if (!trips[tripId]) trips[tripId] = {};
			if (!trips[tripId].days) trips[tripId].days = [];
			trips[tripId].days[dayIndex] = value;
		}
	}
	return trips;
}

/**
 * Read all todos for a trip from the per-entry todos IDB store.
 * Keys are `${tripId}:${todoId}`. Returns todos as an array (unordered).
 */
export async function idbGetTodos(page: Page, tripId: string): Promise<any[]> {
	const all = await idbGetAll(page, 'todos');
	const prefix = `${tripId}:`;
	return Object.entries(all)
		.filter(([k]) => k.startsWith(prefix))
		.map(([, v]) => v);
}

export async function idbGetAll(page: Page, storeName: string): Promise<Record<string, any>> {
	return page.evaluate(
		({ storeName, dbName, dbVersion }) => {
			return new Promise((resolve, reject) => {
				const req = indexedDB.open(dbName, dbVersion);
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					try {
						const tx = db.transaction(storeName, 'readonly');
						const store = tx.objectStore(storeName);
						const getAll = store.getAll();
						getAll.onsuccess = () => {
							const result: Record<string, any> = {};
							for (const row of getAll.result) {
								result[row.key] = row.value;
							}
							resolve(result);
						};
						getAll.onerror = () => reject(getAll.error);
					} catch (e) {
						resolve({});
					}
				};
				req.onupgradeneeded = () => {
					req.result.close();
					resolve({});
				};
			});
		},
		{ storeName, dbName: DB_NAME, dbVersion: DB_VERSION }
	);
}
