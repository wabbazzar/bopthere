import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';
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

export function getCachedBookings(tripId: string): Booking[] {
	return bookingsCache.get(tripId) ?? [];
}

export async function getBookings(tripId: string): Promise<Booking[]> {
	if (!getToken()) return [];
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
		const bookings = (data.bookings as Booking[]) || [];
		bookingsCache.set(tripId, bookings);
		return bookings;
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
