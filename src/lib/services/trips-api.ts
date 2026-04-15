import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';
import type { Trip } from '$lib/types/trip';

const API_URL = PUBLIC_CHAT_API_URL;

function headers(): Record<string, string> {
	const token = getToken();
	return {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {})
	};
}

export interface TripResponse {
	trip: Trip;
	updatedAt: string;
}

export interface TodosResponse {
	todos: { text: string; done: boolean }[];
	updatedAt: string | null;
}

export interface TripListEntry {
	tripId: string;
	updatedAt: string;
}

/**
 * Fetch the server catalog of all persisted trips (id + updatedAt only).
 * Used by clients on init to discover trips created on other devices.
 * Returns [] on any error so the init flow can still proceed with local data.
 */
export async function fetchTripList(): Promise<TripListEntry[]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(`${API_URL}/api/trips`, {
			headers: headers(),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (!res.ok) return [];
		const data = await res.json();
		return (data.trips ?? []) as TripListEntry[];
	} catch {
		clearTimeout(timeout);
		return [];
	}
}

/**
 * Fetch the server-authoritative trip data.
 * Returns null if the server has no row yet (first-time migration case).
 */
export async function fetchTrip(tripId: string): Promise<TripResponse | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
			headers: headers(),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`Failed to fetch trip (${res.status})`);
		const data = await res.json();
		return { trip: data.trip as Trip, updatedAt: data.updatedAt };
	} catch (e) {
		clearTimeout(timeout);
		throw e;
	}
}

/**
 * Save the full trip to the server. Uses LWW — if the server has newer data,
 * returns the server's current state via the error so the caller can reconcile.
 */
export async function saveTrip(
	tripId: string,
	trip: Trip,
	updatedAt: string
): Promise<{ ok: boolean; updatedAt: string; serverTrip?: Trip }> {
	const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify({ trip, updatedAt })
	});
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return {
			ok: false,
			updatedAt: detail.updatedAt ?? updatedAt,
			serverTrip: detail.trip as Trip
		};
	}
	if (!res.ok) throw new Error(`Failed to save trip (${res.status})`);
	const data = await res.json();
	return { ok: true, updatedAt: data.updatedAt };
}

export async function fetchTodos(tripId: string): Promise<TodosResponse> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(`${API_URL}/api/trips/${tripId}/todos`, {
			headers: headers(),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (!res.ok) throw new Error(`Failed to fetch todos (${res.status})`);
		const data = await res.json();
		return { todos: data.todos ?? [], updatedAt: data.updatedAt };
	} catch (e) {
		clearTimeout(timeout);
		throw e;
	}
}

export async function saveTodos(
	tripId: string,
	todos: { text: string; done: boolean }[],
	updatedAt: string
): Promise<{ ok: boolean; updatedAt: string; serverTodos?: { text: string; done: boolean }[] }> {
	const res = await fetch(`${API_URL}/api/trips/${tripId}/todos`, {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify({ todos, updatedAt })
	});
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return {
			ok: false,
			updatedAt: detail.updatedAt ?? updatedAt,
			serverTodos: detail.todos
		};
	}
	if (!res.ok) throw new Error(`Failed to save todos (${res.status})`);
	const data = await res.json();
	return { ok: true, updatedAt: data.updatedAt };
}
