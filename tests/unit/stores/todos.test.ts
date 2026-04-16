/**
 * Unit tests for the todos store.
 *
 * The historical bug these guard against: v1 of the store seeded EVERY trip
 * with China-specific defaults, then auto-pushed those defaults to the
 * server, polluting unrelated trips like europe-2026. The store is now a
 * blank slate per trip, and the schema migration wipes legacy local caches.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

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
	// Each test wipes localStorage and reimports the module so the singleton
	// runs its schema migration + writable() against a clean slate.
	localStorage.clear();
	vi.resetModules();
	const mod = await import('$lib/stores/todos');
	return mod.todosStore;
}

const TODOS_KEY_PREFIX = 'hw-trip-todos-';
const META_KEY = 'hw-todos-meta';
const SCHEMA_VERSION_KEY = 'hw-todos-schema-version';

const LEGACY_DEFAULTS = [
	{ text: 'Book intra-China train/flights', done: false },
	{ text: 'Fill in morning/afternoon activities', done: false },
	{ text: 'Confirm Wulingyuan hotel', done: false }
];

function flushSyncTimers() {
	return new Promise((resolve) => setTimeout(resolve, 2100));
}

describe('todos store — per-trip isolation', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns an empty list for a brand-new trip with no local or server data', async () => {
		const store = await freshStore();
		store.init('europe-2026');
		await new Promise((r) => setTimeout(r, 50));
		expect(get(store)['europe-2026']).toEqual([]);
	});

	it('does NOT seed China-specific defaults for any trip', async () => {
		const store = await freshStore();
		store.init('any-trip-id');
		await new Promise((r) => setTimeout(r, 50));
		const todos = get(store)['any-trip-id'] ?? [];
		for (const t of todos) {
			expect(t.text).not.toMatch(/Wulingyuan/i);
			expect(t.text).not.toMatch(/intra-China/i);
		}
	});

	it('adding a todo to trip A does not affect trip B', async () => {
		const store = await freshStore();
		store.init('trip-a');
		store.init('trip-b');
		await new Promise((r) => setTimeout(r, 50));

		store.add('trip-a', 'Pack passport');

		expect(get(store)['trip-a']).toHaveLength(1);
		expect(get(store)['trip-a'][0].text).toBe('Pack passport');
		expect(get(store)['trip-b']).toEqual([]);
	});

	it('persists per-trip in localStorage under a trip-scoped key', async () => {
		const store = await freshStore();
		store.init('trip-x');
		await new Promise((r) => setTimeout(r, 50));
		store.add('trip-x', 'Buy adapter');
		const raw = localStorage.getItem(TODOS_KEY_PREFIX + 'trip-x');
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw!);
		expect(parsed[0].text).toBe('Buy adapter');
		// Other trip keys should not exist
		expect(localStorage.getItem(TODOS_KEY_PREFIX + 'trip-y')).toBeNull();
	});
});

describe('todos store — schema migration', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('wipes legacy hw-trip-todos-* and meta on first load when version is missing', async () => {
		// Seed legacy state as if v1 of the store had been used
		localStorage.setItem(TODOS_KEY_PREFIX + 'europe-2026', JSON.stringify(LEGACY_DEFAULTS));
		localStorage.setItem(TODOS_KEY_PREFIX + 'china-2026', JSON.stringify(LEGACY_DEFAULTS));
		localStorage.setItem(META_KEY, JSON.stringify({ 'europe-2026': '2026-04-15T00:00:00.000Z' }));

		await freshStore(); // triggers migration

		expect(localStorage.getItem(TODOS_KEY_PREFIX + 'europe-2026')).toBeNull();
		expect(localStorage.getItem(TODOS_KEY_PREFIX + 'china-2026')).toBeNull();
		expect(localStorage.getItem(META_KEY)).toBeNull();
		expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe('2');
	});

	it('does not re-wipe on second load (idempotent)', async () => {
		await freshStore(); // first load: sets version to 2
		// Simulate user activity after migration
		localStorage.setItem(TODOS_KEY_PREFIX + 'china-2026', JSON.stringify([{ text: 'Real edit', done: false }]));

		// Re-import the module without clearing LS — the migration must NOT
		// re-run because the schema version is already 2.
		vi.resetModules();
		await import('$lib/stores/todos');

		expect(localStorage.getItem(TODOS_KEY_PREFIX + 'china-2026')).toBeTruthy();
	});
});

describe('todos store — server sync isolation', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('does NOT auto-push local state for a brand-new trip whose server row is empty', async () => {
		const store = await freshStore();
		const api = await import('$lib/services/trips-api');
		store.init('fresh-trip');
		// Allow pullFromServer to settle
		await new Promise((r) => setTimeout(r, 100));
		// saveTodos must not have been called because user has no edits yet
		expect(api.saveTodos).not.toHaveBeenCalled();
		expect(get(store)['fresh-trip']).toEqual([]);
	});

	it('pushes user edits to the server (not other trips)', async () => {
		const store = await freshStore();
		const api = await import('$lib/services/trips-api');
		store.init('trip-a');
		store.init('trip-b');
		await new Promise((r) => setTimeout(r, 100));

		store.add('trip-a', 'A-only task');
		await flushSyncTimers();

		const calls = (api.saveTodos as unknown as { mock: { calls: unknown[][] } }).mock.calls;
		const tripIdsSaved = calls.map((c) => c[0]);
		expect(tripIdsSaved).toContain('trip-a');
		expect(tripIdsSaved).not.toContain('trip-b');
	});
});
