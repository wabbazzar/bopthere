/**
 * Unit tests for the todos store.
 *
 * The historical bug these guard against: v1 of the store seeded EVERY trip
 * with China-specific defaults, then auto-pushed those defaults to the
 * server, polluting unrelated trips like europe-2026. The store is now a
 * blank slate per trip.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { closeDatabase, dbGet } from '$lib/stores/db';

// Mock the network sync layer so unit tests don't hit the real server.
vi.mock('$lib/services/trips-api', () => {
	const serverState: Record<string, { todos: { text: string; done: boolean }[]; updatedAt: string }> = {};
	return {
		__serverState: serverState,
		fetchTodos: vi.fn(async (tripId: string) => {
			const row = serverState[tripId];
			if (!row) return { todos: [], updatedAt: null };
			return { todos: row.todos, updatedAt: row.updatedAt };
		}),
		saveTodos: vi.fn(async (tripId: string, todos: { text: string; done: boolean }[], updatedAt: string) => {
			serverState[tripId] = { todos, updatedAt };
			return { ok: true, updatedAt };
		})
	};
});

async function freshStore() {
	closeDatabase();
	indexedDB.deleteDatabase('hw-travel');
	localStorage.clear();
	vi.resetModules();
	const mod = await import('$lib/stores/todos');
	return mod.todosStore;
}

function flushSyncTimers() {
	return new Promise((resolve) => setTimeout(resolve, 2100));
}

describe('todos store — per-trip isolation', () => {
	afterEach(() => {
		closeDatabase();
	});

	it('returns an empty list for a brand-new trip with no local or server data', async () => {
		const store = await freshStore();
		await store.init('europe-2026');
		await new Promise((r) => setTimeout(r, 50));
		expect(get(store)['europe-2026']).toEqual([]);
	});

	it('does NOT seed China-specific defaults for any trip', async () => {
		const store = await freshStore();
		await store.init('any-trip-id');
		await new Promise((r) => setTimeout(r, 50));
		const todos = get(store)['any-trip-id'] ?? [];
		for (const t of todos) {
			expect(t.text).not.toMatch(/Wulingyuan/i);
			expect(t.text).not.toMatch(/intra-China/i);
		}
	});

	it('adding a todo to trip A does not affect trip B', async () => {
		const store = await freshStore();
		await store.init('trip-a');
		await store.init('trip-b');
		await new Promise((r) => setTimeout(r, 50));

		store.add('trip-a', 'Pack passport');

		expect(get(store)['trip-a']).toHaveLength(1);
		expect(get(store)['trip-a'][0].text).toBe('Pack passport');
		expect(get(store)['trip-b']).toEqual([]);
	});

	it('persists per-trip in IndexedDB', async () => {
		const store = await freshStore();
		await store.init('trip-x');
		await new Promise((r) => setTimeout(r, 50));
		store.add('trip-x', 'Buy adapter');
		// Allow async IndexedDB write to complete
		await new Promise((r) => setTimeout(r, 100));
		const saved = await dbGet<{ text: string; done: boolean }[]>('todos', 'trip-x');
		expect(saved).toBeTruthy();
		expect(saved![0].text).toBe('Buy adapter');
	});
});

describe('todos store — server sync isolation', () => {
	afterEach(() => {
		closeDatabase();
	});

	it('does NOT auto-push local state for a brand-new trip whose server row is empty', async () => {
		const store = await freshStore();
		const api = await import('$lib/services/trips-api');
		await store.init('fresh-trip');
		// Allow pullFromServer to settle
		await new Promise((r) => setTimeout(r, 100));
		// saveTodos must not have been called because user has no edits yet
		expect(api.saveTodos).not.toHaveBeenCalled();
		expect(get(store)['fresh-trip']).toEqual([]);
	});

	it('pushes user edits to the server (not other trips)', async () => {
		const store = await freshStore();
		const api = await import('$lib/services/trips-api');
		await store.init('trip-a');
		await store.init('trip-b');
		await new Promise((r) => setTimeout(r, 100));

		store.add('trip-a', 'A-only task');
		await flushSyncTimers();

		const calls = (api.saveTodos as unknown as { mock: { calls: unknown[][] } }).mock.calls;
		const tripIdsSaved = calls.map((c) => c[0]);
		expect(tripIdsSaved).toContain('trip-a');
		expect(tripIdsSaved).not.toContain('trip-b');
	});
});
