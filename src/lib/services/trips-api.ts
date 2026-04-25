import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';
import type { Trip, JournalEntry, TripDay, Todo } from '$lib/types/trip';
import type { TourScript } from '$lib/types/script';

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

export interface JournalResponse {
	journal: JournalEntry[];
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
	if (!getToken()) return [];
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
	if (!getToken()) return null;
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

export async function deleteTrip(tripId: string): Promise<void> {
	const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
		method: 'DELETE',
		headers: headers()
	});
	if (!res.ok) throw new Error(`Failed to delete trip (${res.status})`);
}

export async function fetchTodos(tripId: string): Promise<TodosResponse> {
	if (!getToken()) return { todos: [], updatedAt: null };
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

export async function fetchJournal(tripId: string): Promise<JournalResponse> {
	if (!getToken()) return { journal: [], updatedAt: null };
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(`${API_URL}/api/trips/${tripId}/journal`, {
			headers: headers(),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (!res.ok) throw new Error(`Failed to fetch journal (${res.status})`);
		const data = await res.json();
		return { journal: data.journal ?? [], updatedAt: data.updatedAt };
	} catch (e) {
		clearTimeout(timeout);
		throw e;
	}
}

export async function saveJournal(
	tripId: string,
	journal: JournalEntry[],
	updatedAt: string
): Promise<{ ok: boolean; updatedAt: string; serverJournal?: JournalEntry[] }> {
	const res = await fetch(`${API_URL}/api/trips/${tripId}/journal`, {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify({ journal, updatedAt })
	});
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return {
			ok: false,
			updatedAt: detail.updatedAt ?? updatedAt,
			serverJournal: detail.journal
		};
	}
	if (!res.ok) throw new Error(`Failed to save journal (${res.status})`);
	const data = await res.json();
	return { ok: true, updatedAt: data.updatedAt };
}

// ── Journal per-entry API ────────────────────────────────────

export async function fetchJournalEntries(
	tripId: string
): Promise<{ entries: JournalEntry[] }> {
	if (!getToken()) return { entries: [] };
	const res = await fetch(`${API_URL}/api/trips/${tripId}/journal/entries`, {
		headers: headers()
	});
	if (!res.ok) throw new Error(`Failed to fetch journal entries (${res.status})`);
	const data = await res.json();
	return { entries: data.entries ?? [] };
}

export async function saveJournalEntry(
	tripId: string,
	dayIndex: number,
	entry: JournalEntry,
	version: number | null
): Promise<{ ok: boolean; version: number; serverEntry?: JournalEntry }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/journal/entries/${dayIndex}`,
		{
			method: 'PUT',
			headers: headers(),
			body: JSON.stringify({ entry, version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version, serverEntry: detail.serverEntry };
	}
	if (!res.ok) throw new Error(`Failed to save journal entry (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

export async function deleteJournalEntry(
	tripId: string,
	dayIndex: number,
	version: number
): Promise<{ ok: boolean; version: number }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/journal/entries/${dayIndex}`,
		{
			method: 'DELETE',
			headers: headers(),
			body: JSON.stringify({ version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version };
	}
	if (!res.ok) throw new Error(`Failed to delete journal entry (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

// ── Trip day per-entry API ───────────────────────────────────

export async function fetchTripDays(
	tripId: string
): Promise<{ days: (TripDay & { _version: number })[] }> {
	if (!getToken()) return { days: [] };
	const res = await fetch(`${API_URL}/api/trips/${tripId}/days`, {
		headers: headers()
	});
	if (!res.ok) throw new Error(`Failed to fetch trip days (${res.status})`);
	const data = await res.json();
	return { days: data.days ?? [] };
}

export async function saveTripDay(
	tripId: string,
	dayIndex: number,
	day: TripDay,
	version: number | null
): Promise<{ ok: boolean; version: number; serverDay?: TripDay }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/days/${dayIndex}`,
		{
			method: 'PUT',
			headers: headers(),
			body: JSON.stringify({ day, version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version, serverDay: detail.serverDay };
	}
	if (!res.ok) throw new Error(`Failed to save trip day (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

export async function deleteTripDay(
	tripId: string,
	dayIndex: number,
	version: number
): Promise<{ ok: boolean; version: number }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/days/${dayIndex}`,
		{
			method: 'DELETE',
			headers: headers(),
			body: JSON.stringify({ version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version };
	}
	if (!res.ok) throw new Error(`Failed to delete trip day (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

// ── Trip meta API ────────────────────────────────────────────

export async function fetchTripMeta(
	tripId: string
): Promise<{ meta: Record<string, unknown>; version: number } | null> {
	if (!getToken()) return null;
	const res = await fetch(`${API_URL}/api/trips/${tripId}/meta`, {
		headers: headers()
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Failed to fetch trip meta (${res.status})`);
	const data = await res.json();
	return { meta: data.meta, version: data.version };
}

export async function saveTripMeta(
	tripId: string,
	meta: Record<string, unknown>,
	version: number | null
): Promise<{ ok: boolean; version: number; serverMeta?: Record<string, unknown> }> {
	const res = await fetch(`${API_URL}/api/trips/${tripId}/meta`, {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify({ meta, version })
	});
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version, serverMeta: detail.serverMeta };
	}
	if (!res.ok) throw new Error(`Failed to save trip meta (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

// ── Todo per-entry API ───────────────────────────────────────

export async function fetchTodoEntries(
	tripId: string
): Promise<{ entries: (Todo & { _version: number; id: string })[] }> {
	if (!getToken()) return { entries: [] };
	const res = await fetch(`${API_URL}/api/trips/${tripId}/todos/entries`, {
		headers: headers()
	});
	if (!res.ok) throw new Error(`Failed to fetch todo entries (${res.status})`);
	const data = await res.json();
	return { entries: data.entries ?? [] };
}

export async function saveTodoEntry(
	tripId: string,
	todoId: string,
	entry: Todo,
	sortOrder: number,
	version: number | null
): Promise<{ ok: boolean; version: number; serverEntry?: Todo }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/todos/entries/${todoId}`,
		{
			method: 'PUT',
			headers: headers(),
			body: JSON.stringify({ entry, sortOrder, version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version, serverEntry: detail.serverEntry };
	}
	if (!res.ok) throw new Error(`Failed to save todo entry (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

export async function createTodoEntry(
	tripId: string,
	entry: Todo,
	sortOrder: number
): Promise<{ ok: boolean; todoId: string; version: number }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/todos/entries`,
		{
			method: 'POST',
			headers: headers(),
			body: JSON.stringify({ entry, sortOrder })
		}
	);
	if (!res.ok) throw new Error(`Failed to create todo entry (${res.status})`);
	const data = await res.json();
	return { ok: true, todoId: data.todoId, version: data.version };
}

export async function deleteTodoEntry(
	tripId: string,
	todoId: string,
	version: number
): Promise<{ ok: boolean; version: number }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/todos/entries/${todoId}`,
		{
			method: 'DELETE',
			headers: headers(),
			body: JSON.stringify({ version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version };
	}
	if (!res.ok) throw new Error(`Failed to delete todo entry (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

// ── Script entry API ─────────────────────────────────────────

export async function fetchScriptEntries(
	tripId: string
): Promise<{ entries: (TourScript & { _version: number })[] }> {
	if (!getToken()) return { entries: [] };
	const res = await fetch(`${API_URL}/api/trips/${tripId}/scripts/entries`, {
		headers: headers()
	});
	if (!res.ok) throw new Error(`Failed to fetch script entries (${res.status})`);
	const data = await res.json();
	return { entries: data.entries ?? [] };
}

export async function saveScriptEntry(
	tripId: string,
	scriptId: string,
	entry: TourScript,
	version: number | null
): Promise<{ ok: boolean; version: number; serverEntry?: TourScript }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/scripts/entries/${scriptId}`,
		{
			method: 'PUT',
			headers: headers(),
			body: JSON.stringify({ entry, version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version, serverEntry: detail.serverEntry };
	}
	if (!res.ok) throw new Error(`Failed to save script entry (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}

export async function deleteScriptEntry(
	tripId: string,
	scriptId: string,
	version: number
): Promise<{ ok: boolean; version: number }> {
	const res = await fetch(
		`${API_URL}/api/trips/${tripId}/scripts/entries/${scriptId}`,
		{
			method: 'DELETE',
			headers: headers(),
			body: JSON.stringify({ version })
		}
	);
	if (res.status === 409) {
		const data = await res.json();
		const detail = data.detail ?? data;
		return { ok: false, version: detail.version };
	}
	if (!res.ok) throw new Error(`Failed to delete script entry (${res.status})`);
	const data = await res.json();
	return { ok: true, version: data.version };
}
