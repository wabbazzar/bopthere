import { PUBLIC_API_GATEWAY_URL } from '$env/static/public';
import type { LoginResponse, User } from '$lib/types/auth';

const API_URL = PUBLIC_API_GATEWAY_URL;
const TOKEN_KEY = 'hw-auth-token';
const USER_KEY = 'hw-auth-user';

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
	saveAuth(data.token, data.user);
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
			clearAuth();
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
			clearAuth();
			return null;
		}

		const data: LoginResponse = await res.json();
		saveAuth(data.token, data.user);
		return data;
	} catch {
		return null;
	}
}

export function logout(): void {
	clearAuth();
}

export function getToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(USER_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function saveAuth(token: string, user: User): void {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth(): void {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(USER_KEY);
}
