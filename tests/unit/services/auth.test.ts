import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getToken, getStoredUser, logout, hydrateAuth } from '$lib/services/auth';
import { dbPut, closeDatabase } from '$lib/stores/db';

describe('auth service helpers (IndexedDB-backed)', () => {
	beforeEach(() => {
		closeDatabase();
		indexedDB.deleteDatabase('hw-travel');
	});

	afterEach(() => {
		closeDatabase();
	});

	describe('getToken', () => {
		it('returns null before hydration', () => {
			expect(getToken()).toBeNull();
		});

		it('returns token after hydrating from IndexedDB', async () => {
			await dbPut('auth', 'token', 'test-jwt-123');
			await hydrateAuth();
			expect(getToken()).toBe('test-jwt-123');
		});

		it('returns null when IndexedDB has no token', async () => {
			await hydrateAuth();
			expect(getToken()).toBeNull();
		});
	});

	describe('getStoredUser', () => {
		it('returns null before hydration', () => {
			expect(getStoredUser()).toBeNull();
		});

		it('returns user after hydrating from IndexedDB', async () => {
			const user = { username: 'wesley', email: 'w@test.com', full_name: 'Wesley', role: 'admin' };
			await dbPut('auth', 'user', user);
			await hydrateAuth();
			expect(getStoredUser()).toEqual(user);
		});

		it('returns null when IndexedDB has no user', async () => {
			await hydrateAuth();
			expect(getStoredUser()).toBeNull();
		});
	});

	describe('logout', () => {
		it('clears in-memory cache and IndexedDB entries', async () => {
			await dbPut('auth', 'token', 'test-token');
			await dbPut('auth', 'user', { username: 'wesley' });
			await hydrateAuth();

			expect(getToken()).toBe('test-token');
			expect(getStoredUser()).toEqual({ username: 'wesley' });

			await logout();

			expect(getToken()).toBeNull();
			expect(getStoredUser()).toBeNull();
		});
	});

	describe('hydrateAuth', () => {
		it('is idempotent — can be called multiple times', async () => {
			await dbPut('auth', 'token', 'jwt-1');
			await hydrateAuth();
			expect(getToken()).toBe('jwt-1');

			await dbPut('auth', 'token', 'jwt-2');
			await hydrateAuth();
			expect(getToken()).toBe('jwt-2');
		});
	});
});
