import { PUBLIC_API_GATEWAY_URL } from '$env/static/public';
import type { LoginResponse, User } from '$lib/types/auth';
import { dbGet, dbPut, dbDelete } from '$lib/stores/db';

const API_URL = PUBLIC_API_GATEWAY_URL;

// In-memory cache for synchronous access after hydration
let cachedToken: string | null = null;
let cachedUser: User | null = null;

/**
 * Hydrate the in-memory auth cache from IndexedDB.
 * Must be called once during app init (before any getToken() calls).
 */
export async function hydrateAuth(): Promise<void> {
	cachedToken = (await dbGet<string>('auth', 'token')) ?? null;
	cachedUser = (await dbGet<User>('auth', 'user')) ?? null;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
	const res = await fetch(`${API_URL}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ message: 'Login failed' }));
		throw new Error(err.message || 'Login failed');
	}

	const data: LoginResponse = await res.json();
	await saveAuth(data.token, data.user);
	return data;
}

export async function verifyToken(): Promise<User | null> {
	const token = getToken();
	if (!token) return null;

	try {
		const res = await fetch(`${API_URL}/auth/verify`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			}
		});

		if (!res.ok) {
			await clearAuth();
			return null;
		}

		const data = await res.json();
		return data.user;
	} catch {
		return null;
	}
}

export async function refreshToken(): Promise<LoginResponse | null> {
	const token = getToken();
	if (!token) return null;

	try {
		const res = await fetch(`${API_URL}/auth/refresh`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			}
		});

		if (!res.ok) {
			await clearAuth();
			return null;
		}

		const data: LoginResponse = await res.json();
		await saveAuth(data.token, data.user);
		return data;
	} catch {
		return null;
	}
}

export async function logout(): Promise<void> {
	await clearAuth();
}

export function getToken(): string | null {
	return cachedToken;
}

export function getStoredUser(): User | null {
	return cachedUser;
}

async function saveAuth(token: string, user: User): Promise<void> {
	cachedToken = token;
	cachedUser = user;
	await dbPut('auth', 'token', token);
	await dbPut('auth', 'user', user);
}

async function clearAuth(): Promise<void> {
	cachedToken = null;
	cachedUser = null;
	await dbDelete('auth', 'token');
	await dbDelete('auth', 'user');
}
