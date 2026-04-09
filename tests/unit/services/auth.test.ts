import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, getStoredUser, logout } from '$lib/services/auth';

describe('auth service helpers', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('getToken', () => {
		it('returns null when no token stored', () => {
			expect(getToken()).toBeNull();
		});

		it('returns stored token', () => {
			localStorage.setItem('hw-auth-token', 'test-jwt-123');
			expect(getToken()).toBe('test-jwt-123');
		});
	});

	describe('getStoredUser', () => {
		it('returns null when no user stored', () => {
			expect(getStoredUser()).toBeNull();
		});

		it('returns parsed user object', () => {
			const user = { username: 'wesley', email: 'w@test.com', full_name: 'Wesley', role: 'admin' };
			localStorage.setItem('hw-auth-user', JSON.stringify(user));
			expect(getStoredUser()).toEqual(user);
		});

		it('returns null for invalid JSON', () => {
			localStorage.setItem('hw-auth-user', 'not-json');
			expect(getStoredUser()).toBeNull();
		});
	});

	describe('logout', () => {
		it('clears both token and user', () => {
			localStorage.setItem('hw-auth-token', 'test-token');
			localStorage.setItem('hw-auth-user', '{"username":"wesley"}');
			logout();
			expect(localStorage.getItem('hw-auth-token')).toBeNull();
			expect(localStorage.getItem('hw-auth-user')).toBeNull();
		});
	});
});
