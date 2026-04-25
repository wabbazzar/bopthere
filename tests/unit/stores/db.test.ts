import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	openDatabase,
	dbGet,
	dbPut,
	dbDelete,
	dbGetAll,
	dbClearStore,
	closeDatabase
} from '$lib/stores/db';

describe('db.ts — IndexedDB wrapper', () => {
	beforeEach(() => {
		closeDatabase();
		// Wipe the database so each test starts clean
		indexedDB.deleteDatabase('hw-travel');
	});

	afterEach(() => {
		closeDatabase();
	});

	describe('openDatabase', () => {
		it('returns an IDBDatabase instance', async () => {
			const db = await openDatabase();
			expect(db).toBeInstanceOf(IDBDatabase);
		});

		it('returns the same instance on repeated calls (singleton)', async () => {
			const db1 = await openDatabase();
			const db2 = await openDatabase();
			expect(db1).toBe(db2);
		});

		it('creates all 6 object stores', async () => {
			const db = await openDatabase();
			expect(db).not.toBeNull();
			const stores = Array.from(db!.objectStoreNames);
			expect(stores).toContain('auth');
			expect(stores).toContain('trips');
			expect(stores).toContain('journal');
			expect(stores).toContain('todos');
			expect(stores).toContain('meta');
			expect(stores).toContain('prefs');
			expect(stores).toContain('scripts');
			expect(stores).toHaveLength(7);
		});

		it('returns a new instance after closeDatabase()', async () => {
			const db1 = await openDatabase();
			closeDatabase();
			const db2 = await openDatabase();
			expect(db2).toBeInstanceOf(IDBDatabase);
			expect(db2).not.toBe(db1);
		});
	});

	describe('dbPut + dbGet roundtrip', () => {
		it('stores and retrieves a string value', async () => {
			await dbPut('auth', 'token', 'jwt-abc-123');
			const result = await dbGet<string>('auth', 'token');
			expect(result).toBe('jwt-abc-123');
		});

		it('stores and retrieves an object value', async () => {
			const user = { username: 'wesley', role: 'admin' };
			await dbPut('auth', 'user', user);
			const result = await dbGet<{ username: string; role: string }>('auth', 'user');
			expect(result).toEqual(user);
		});

		it('stores and retrieves an array value', async () => {
			const entries = [{ dayIndex: 0, text: 'hello' }, { dayIndex: 1, text: 'world' }];
			await dbPut('journal', 'china-2026', entries);
			const result = await dbGet<typeof entries>('journal', 'china-2026');
			expect(result).toEqual(entries);
		});

		it('returns undefined for a nonexistent key', async () => {
			const result = await dbGet<string>('auth', 'nonexistent');
			expect(result).toBeUndefined();
		});

		it('overwrites an existing key', async () => {
			await dbPut('prefs', 'theme', 'light');
			await dbPut('prefs', 'theme', 'dark');
			const result = await dbGet<string>('prefs', 'theme');
			expect(result).toBe('dark');
		});
	});

	describe('dbDelete', () => {
		it('removes a key that exists', async () => {
			await dbPut('auth', 'token', 'delete-me');
			await dbDelete('auth', 'token');
			const result = await dbGet<string>('auth', 'token');
			expect(result).toBeUndefined();
		});

		it('is a no-op for a nonexistent key', async () => {
			await dbDelete('auth', 'nonexistent');
			// Should not throw
		});
	});

	describe('dbGetAll', () => {
		it('returns all entries in a store', async () => {
			await dbPut('prefs', 'key1', 'val1');
			await dbPut('prefs', 'key2', 'val2');
			await dbPut('prefs', 'key3', 'val3');
			const all = await dbGetAll<string>('prefs');
			expect(all).toHaveLength(3);
			const keys = all.map((r) => r.key).sort();
			expect(keys).toEqual(['key1', 'key2', 'key3']);
			const values = all.map((r) => r.value).sort();
			expect(values).toEqual(['val1', 'val2', 'val3']);
		});

		it('returns empty array for an empty store', async () => {
			const all = await dbGetAll<string>('prefs');
			expect(all).toEqual([]);
		});
	});

	describe('dbClearStore', () => {
		it('removes all entries from a store', async () => {
			await dbPut('meta', 'a', 1);
			await dbPut('meta', 'b', 2);
			await dbClearStore('meta');
			const all = await dbGetAll('meta');
			expect(all).toEqual([]);
		});

		it('does not affect other stores', async () => {
			await dbPut('meta', 'a', 1);
			await dbPut('prefs', 'b', 2);
			await dbClearStore('meta');
			const metaAll = await dbGetAll('meta');
			const prefsAll = await dbGetAll('prefs');
			expect(metaAll).toEqual([]);
			expect(prefsAll).toHaveLength(1);
		});
	});

	describe('cross-store isolation', () => {
		it('same key in different stores holds different values', async () => {
			await dbPut('auth', 'token', 'auth-token');
			await dbPut('meta', 'token', 'meta-token');
			expect(await dbGet<string>('auth', 'token')).toBe('auth-token');
			expect(await dbGet<string>('meta', 'token')).toBe('meta-token');
		});
	});

	describe('data types', () => {
		it('handles null value', async () => {
			await dbPut('prefs', 'nullable', null);
			const result = await dbGet('prefs', 'nullable');
			expect(result).toBeNull();
		});

		it('handles numeric value', async () => {
			await dbPut('prefs', 'count', 42);
			expect(await dbGet<number>('prefs', 'count')).toBe(42);
		});

		it('handles boolean value', async () => {
			await dbPut('prefs', 'enabled', true);
			expect(await dbGet<boolean>('prefs', 'enabled')).toBe(true);
		});

		it('handles deeply nested object', async () => {
			const nested = { a: { b: { c: [1, 2, { d: 'deep' }] } } };
			await dbPut('trips', 'nested', nested);
			expect(await dbGet('trips', 'nested')).toEqual(nested);
		});
	});
});
