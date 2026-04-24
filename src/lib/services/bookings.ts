import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';
import { dbGet, dbPut } from '$lib/stores/db';
import type { Booking } from '$lib/types/trip';

const API_URL = PUBLIC_CHAT_API_URL;

function headers(): Record<string, string> {
	const token = getToken();
	return {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {})
	};
}

/**
 * In-memory cache of bookings per trip, populated by the trip page after
 * fetching from the backend. The chat system-prompt builder reads from
 * this so it can still summarize bookings without the trip object
 * carrying them as a field.
 */
const bookingsCache = new Map<string, Booking[]>();

function idbKey(tripId: string): string {
	return `bookings:${tripId}`;
}

export function getCachedBookings(tripId: string): Booking[] {
	return bookingsCache.get(tripId) ?? [];
}

/**
 * Load bookings with stale-while-revalidate: return cached data from
 * IndexedDB instantly, then fetch fresh data from the server in the
 * background. The optional onUpdate callback fires if the server
 * returns newer data than what was cached.
 */
export async function getBookings(
	tripId: string,
	onUpdate?: (bookings: Booking[]) => void
): Promise<Booking[]> {
	if (!getToken()) return [];

	// 1. Try local cache first (IndexedDB)
	const cached = await dbGet<Booking[]>('meta', idbKey(tripId));

	// 2. Fetch from server in background
	const fetchPromise = fetchBookingsFromServer(tripId).then((fresh) => {
		if (fresh) {
			bookingsCache.set(tripId, fresh);
			dbPut('meta', idbKey(tripId), fresh).catch(() => {});
			if (onUpdate) onUpdate(fresh);
		}
		return fresh;
	}).catch((e) => {
		console.error('[bookings] background refresh failed:', e);
		return null;
	});

	// 3. If we have cached data, return it immediately
	if (cached && cached.length > 0) {
		bookingsCache.set(tripId, cached);
		return cached;
	}

	// 4. No cache — wait for server response
	const fresh = await fetchPromise;
	return fresh ?? [];
}

async function fetchBookingsFromServer(tripId: string): Promise<Booking[] | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(`${API_URL}/api/trips/${tripId}/bookings`, {
			headers: headers(),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
		const data = await res.json();
		return (data.bookings as Booking[]) || [];
	} catch (e) {
		clearTimeout(timeout);
		throw e;
	}
}

/** Ask the backend for a short-lived signed URL for an attachment. */
export async function signTicketUrl(tripId: string, name: string): Promise<string> {
	const res = await fetch(`${API_URL}/api/trips/${tripId}/attachments/sign`, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify({ name })
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ detail: 'sign failed' }));
		throw new Error(err.detail || `sign failed (${res.status})`);
	}
	const data = await res.json();
	// Backend returns a path; prefix with the API host so the browser can open it
	return `${API_URL}${data.url}`;
}
