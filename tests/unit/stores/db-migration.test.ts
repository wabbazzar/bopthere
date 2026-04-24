import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrateLocalStorageToIndexedDB } from '$lib/stores/db-migration';
import { dbGet, dbGetAll, closeDatabase } from '$lib/stores/db';

describe('db-migration.ts — localStorage to IndexedDB migration', () => {
	beforeEach(() => {
		closeDatabase();
		indexedDB.deleteDatabase('hw-travel');
		localStorage.clear();
	});

	afterEach(() => {
		closeDatabase();
	});

	describe('basic migration', () => {
		it('migrates auth token and user', async () => {
			localStorage.setItem('hw-auth-token', 'jwt-test-123');
			localStorage.setItem('hw-auth-user', JSON.stringify({ username: 'wesley', role: 'admin' }));

			const result = await migrateLocalStorageToIndexedDB();
			expect(result.migrated).toBe(true);
			expect(result.keysProcessed).toBeGreaterThanOrEqual(2);

			expect(await dbGet<string>('auth', 'token')).toBe('jwt-test-123');
			expect(await dbGet<{ username: string }>('auth', 'user')).toEqual({ username: 'wesley', role: 'admin' });
		});

		it('migrates trip data (per-trip entries in trips store)', async () => {
			const trips = {
				'china-2026': { id: 'china-2026', name: 'China 2026', days: [] },
				'europe-2026': { id: 'europe-2026', name: 'Europe 2026', days: [] }
			};
			localStorage.setItem('hw-trips', JSON.stringify(trips));

			await migrateLocalStorageToIndexedDB();

			const china = await dbGet('trips', 'china-2026');
			expect(china).toEqual(trips['china-2026']);
			const europe = await dbGet('trips', 'europe-2026');
			expect(europe).toEqual(trips['europe-2026']);
		});

		it('migrates journal entries per trip', async () => {
			const journal = [{ dayIndex: 0, blocks: [{ id: '1', type: 'text', content: 'Hello' }] }];
			localStorage.setItem('hw-journal-china-2026', JSON.stringify(journal));

			await migrateLocalStorageToIndexedDB();

			expect(await dbGet('journal', 'china-2026')).toEqual(journal);
		});

		it('migrates todos per trip', async () => {
			const todos = [{ text: 'Pack bags', done: false }];
			localStorage.setItem('hw-trip-todos-china-2026', JSON.stringify(todos));

			await migrateLocalStorageToIndexedDB();

			expect(await dbGet('todos', 'china-2026')).toEqual(todos);
		});

		it('migrates meta keys', async () => {
			const meta = { 'china-2026': '2026-04-24T00:00:00Z' };
			localStorage.setItem('hw-trips-meta', JSON.stringify(meta));
			localStorage.setItem('hw-journal-meta', JSON.stringify(meta));
			localStorage.setItem('hw-todos-meta', JSON.stringify(meta));

			const result = await migrateLocalStorageToIndexedDB();
			expect(result.keysProcessed).toBeGreaterThanOrEqual(3);

			expect(await dbGet('meta', 'hw-trips-meta')).toEqual(meta);
			expect(await dbGet('meta', 'hw-journal-meta')).toEqual(meta);
			expect(await dbGet('meta', 'hw-todos-meta')).toEqual(meta);
		});

		it('migrates sync pending flag', async () => {
			localStorage.setItem('hw-trips-sync-pending', 'china-2026,europe-2026');

			await migrateLocalStorageToIndexedDB();

			expect(await dbGet('meta', 'hw-trips-sync-pending')).toBe('china-2026,europe-2026');
		});

		it('migrates schema version', async () => {
			localStorage.setItem('hw-todos-schema-version', '2');

			await migrateLocalStorageToIndexedDB();

			expect(await dbGet('meta', 'hw-todos-schema-version')).toBe('2');
		});

		it('migrates UI preferences', async () => {
			localStorage.setItem('hw-last-path', '/trip/china-2026');
			localStorage.setItem('hw-trip-day-china-2026', '3');
			localStorage.setItem('hw-trip-view-china-2026', 'day');

			await migrateLocalStorageToIndexedDB();

			expect(await dbGet('prefs', 'hw-last-path')).toBe('/trip/china-2026');
			expect(await dbGet('prefs', 'hw-trip-day-china-2026')).toBe('3');
			expect(await dbGet('prefs', 'hw-trip-view-china-2026')).toBe('day');
		});
	});

	describe('cleanup', () => {
		it('removes all hw-* keys from localStorage after migration', async () => {
			localStorage.setItem('hw-auth-token', 'token');
			localStorage.setItem('hw-trips', '{}');
			localStorage.setItem('hw-journal-china-2026', '[]');
			localStorage.setItem('hw-last-path', '/dashboard');

			await migrateLocalStorageToIndexedDB();

			// Only the migration flag should remain
			const remainingKeys: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k) remainingKeys.push(k);
			}
			expect(remainingKeys).toEqual(['hw-idb-migration-complete']);
		});

		it('sets the migration flag', async () => {
			await migrateLocalStorageToIndexedDB();
			expect(localStorage.getItem('hw-idb-migration-complete')).toBe('true');
		});

		it('does not remove non-hw keys from localStorage', async () => {
			localStorage.setItem('some-other-app', 'data');
			localStorage.setItem('hw-auth-token', 'token');

			await migrateLocalStorageToIndexedDB();

			expect(localStorage.getItem('some-other-app')).toBe('data');
		});
	});

	describe('idempotency', () => {
		it('returns early with "Already migrated" on second call', async () => {
			localStorage.setItem('hw-auth-token', 'token');
			const first = await migrateLocalStorageToIndexedDB();
			expect(first.migrated).toBe(true);

			const second = await migrateLocalStorageToIndexedDB();
			expect(second.migrated).toBe(false);
			expect(second.message).toBe('Already migrated');
		});

		it('does not double-write on second call', async () => {
			localStorage.setItem('hw-auth-token', 'original');
			await migrateLocalStorageToIndexedDB();

			// Even if we put a new token in localStorage, migration won't re-run
			localStorage.setItem('hw-auth-token', 'overwritten');
			await migrateLocalStorageToIndexedDB();

			expect(await dbGet<string>('auth', 'token')).toBe('original');
		});
	});

	describe('empty localStorage', () => {
		it('completes successfully with 0 keys processed', async () => {
			const result = await migrateLocalStorageToIndexedDB();
			expect(result.migrated).toBe(true);
			expect(result.keysProcessed).toBe(0);
		});

		it('still sets the migration flag', async () => {
			await migrateLocalStorageToIndexedDB();
			expect(localStorage.getItem('hw-idb-migration-complete')).toBe('true');
		});
	});

	describe('malformed data handling', () => {
		it('skips malformed auth user JSON without blocking migration', async () => {
			localStorage.setItem('hw-auth-token', 'valid-token');
			localStorage.setItem('hw-auth-user', 'not-json{{{');

			const result = await migrateLocalStorageToIndexedDB();
			expect(result.migrated).toBe(true);

			// Token should still migrate
			expect(await dbGet<string>('auth', 'token')).toBe('valid-token');
			// User should be skipped
			expect(await dbGet('auth', 'user')).toBeUndefined();
		});

		it('skips malformed trips JSON', async () => {
			localStorage.setItem('hw-trips', '{broken');
			localStorage.setItem('hw-auth-token', 'ok');

			const result = await migrateLocalStorageToIndexedDB();
			expect(result.migrated).toBe(true);
			expect(await dbGet<string>('auth', 'token')).toBe('ok');
		});

		it('skips malformed journal entry but continues with others', async () => {
			localStorage.setItem('hw-journal-bad', '{bad json}');
			localStorage.setItem('hw-journal-good', JSON.stringify([{ dayIndex: 0 }]));

			const result = await migrateLocalStorageToIndexedDB();
			expect(result.migrated).toBe(true);
			expect(await dbGet('journal', 'good')).toEqual([{ dayIndex: 0 }]);
			expect(await dbGet('journal', 'bad')).toBeUndefined();
		});

		it('skips malformed meta JSON', async () => {
			localStorage.setItem('hw-trips-meta', 'not json');

			const result = await migrateLocalStorageToIndexedDB();
			expect(result.migrated).toBe(true);
			expect(await dbGet('meta', 'hw-trips-meta')).toBeUndefined();
		});
	});

	describe('data preservation on failure', () => {
		it('does not clear localStorage if migration flag says incomplete', async () => {
			localStorage.setItem('hw-auth-token', 'precious-token');
			// Migration hasn't run yet — localStorage should still have data
			expect(localStorage.getItem('hw-auth-token')).toBe('precious-token');
		});
	});

	describe('comprehensive migration', () => {
		it('migrates all key types in a single run', async () => {
			// Set up ALL key types
			localStorage.setItem('hw-auth-token', 'jwt-123');
			localStorage.setItem('hw-auth-user', JSON.stringify({ username: 'heather' }));
			localStorage.setItem('hw-trips', JSON.stringify({ 'china-2026': { id: 'china-2026' } }));
			localStorage.setItem('hw-journal-china-2026', JSON.stringify([{ dayIndex: 0 }]));
			localStorage.setItem('hw-trip-todos-china-2026', JSON.stringify([{ text: 'Buy tickets' }]));
			localStorage.setItem('hw-trips-meta', JSON.stringify({ 'china-2026': '2026-04-24' }));
			localStorage.setItem('hw-journal-meta', JSON.stringify({ 'china-2026': '2026-04-24' }));
			localStorage.setItem('hw-todos-meta', JSON.stringify({ 'china-2026': '2026-04-24' }));
			localStorage.setItem('hw-trips-sync-pending', 'china-2026');
			localStorage.setItem('hw-todos-schema-version', '2');
			localStorage.setItem('hw-last-path', '/trip/china-2026');
			localStorage.setItem('hw-trip-day-china-2026', '5');
			localStorage.setItem('hw-trip-view-china-2026', 'week');

			const result = await migrateLocalStorageToIndexedDB();
			expect(result.migrated).toBe(true);
			expect(result.keysProcessed).toBe(13);

			// Verify all stores have data
			expect(await dbGet('auth', 'token')).toBe('jwt-123');
			expect(await dbGet('auth', 'user')).toEqual({ username: 'heather' });
			expect(await dbGet('trips', 'china-2026')).toEqual({ id: 'china-2026' });
			expect(await dbGet('journal', 'china-2026')).toEqual([{ dayIndex: 0 }]);
			expect(await dbGet('todos', 'china-2026')).toEqual([{ text: 'Buy tickets' }]);
			expect(await dbGet('meta', 'hw-trips-meta')).toEqual({ 'china-2026': '2026-04-24' });
			expect(await dbGet('meta', 'hw-trips-sync-pending')).toBe('china-2026');
			expect(await dbGet('meta', 'hw-todos-schema-version')).toBe('2');
			expect(await dbGet('prefs', 'hw-last-path')).toBe('/trip/china-2026');
			expect(await dbGet('prefs', 'hw-trip-day-china-2026')).toBe('5');
			expect(await dbGet('prefs', 'hw-trip-view-china-2026')).toBe('week');

			// localStorage should only have the migration flag
			const remaining: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k) remaining.push(k);
			}
			expect(remaining).toEqual(['hw-idb-migration-complete']);
		});
	});
});
