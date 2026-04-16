import { writable, get } from 'svelte/store';

export interface Todo {
	text: string;
	done: boolean;
}

type TodosByTrip = Record<string, Todo[]>;

const TODOS_KEY_PREFIX = 'hw-trip-todos-';
const META_KEY = 'hw-todos-meta';
const SCHEMA_VERSION_KEY = 'hw-todos-schema-version';
const CURRENT_SCHEMA_VERSION = '2';
const SYNC_DEBOUNCE_MS = 2000;

/**
 * One-time wipe of legacy todo caches. v1 of this store seeded EVERY trip
 * with China-specific defaults ("Book intra-China train/flights", …) and
 * then auto-pushed those defaults to the server, polluting other trips like
 * europe-2026. v2 bumps the schema and clears all local todo caches so the
 * server (now cleaned) becomes the single source of truth.
 */
function migrateSchema() {
	if (typeof localStorage === 'undefined') return;
	if (localStorage.getItem(SCHEMA_VERSION_KEY) === CURRENT_SCHEMA_VERSION) return;
	const toRemove: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (k && (k.startsWith(TODOS_KEY_PREFIX) || k === META_KEY)) toRemove.push(k);
	}
	for (const k of toRemove) localStorage.removeItem(k);
	localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
}

function loadLocal(tripId: string): Todo[] {
	if (typeof localStorage === 'undefined') return [];
	const raw = localStorage.getItem(TODOS_KEY_PREFIX + tripId);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as Todo[];
	} catch {
		return [];
	}
}

function saveLocal(tripId: string, todos: Todo[]) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(TODOS_KEY_PREFIX + tripId, JSON.stringify(todos));
}

function loadMeta(): Record<string, string> {
	if (typeof localStorage === 'undefined') return {};
	try {
		return JSON.parse(localStorage.getItem(META_KEY) || '{}');
	} catch {
		return {};
	}
}

function setMeta(tripId: string, ts: string) {
	if (typeof localStorage === 'undefined') return;
	const m = loadMeta();
	m[tripId] = ts;
	localStorage.setItem(META_KEY, JSON.stringify(m));
}

function createTodosStore() {
	migrateSchema();
	const { subscribe, update, set: _set } = writable<TodosByTrip>({});
	const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function getTrip(tripId: string): Todo[] {
		return get({ subscribe })[tripId] ?? [];
	}

	function persistAndSync(tripId: string, next: Todo[]) {
		saveLocal(tripId, next);
		setMeta(tripId, new Date().toISOString());
		scheduleSync(tripId);
	}

	function scheduleSync(tripId: string) {
		const existing = syncTimers.get(tripId);
		if (existing) clearTimeout(existing);
		syncTimers.set(tripId, setTimeout(() => {
			syncTimers.delete(tripId);
			pushToServer(tripId);
		}, SYNC_DEBOUNCE_MS));
	}

	async function pushToServer(tripId: string) {
		try {
			const { saveTodos } = await import('$lib/services/trips-api');
			const todos = getTrip(tripId);
			const meta = loadMeta();
			const updatedAt = meta[tripId] || new Date().toISOString();
			const result = await saveTodos(tripId, todos, updatedAt);
			if (result.ok) {
				setMeta(tripId, result.updatedAt);
			} else if (result.serverTodos) {
				update((state) => ({ ...state, [tripId]: result.serverTodos! }));
				saveLocal(tripId, result.serverTodos);
				setMeta(tripId, result.updatedAt);
			}
		} catch {
			// offline — localStorage has latest, will retry on next save
		}
	}

	async function pullFromServer(tripId: string) {
		try {
			const { fetchTodos, saveTodos } = await import('$lib/services/trips-api');
			const result = await fetchTodos(tripId);
			const meta = loadMeta();
			const localTs = meta[tripId] || '';
			if (result.updatedAt === null) {
				// No server row. Only migrate local state up if the user has
				// actually edited it (meta entry exists). Without this guard
				// any stale/seeded local state would pollute the server row
				// for a brand-new trip — which is exactly how China defaults
				// leaked into Europe.
				if (localTs) {
					const todos = getTrip(tripId);
					const saveResult = await saveTodos(tripId, todos, localTs);
					if (saveResult.ok) setMeta(tripId, saveResult.updatedAt);
				} else {
					// No server, no user edits → start clean.
					update((state) => ({ ...state, [tripId]: [] }));
					saveLocal(tripId, []);
				}
			} else if (!localTs || result.updatedAt > localTs) {
				// Server is newer — accept
				update((state) => ({ ...state, [tripId]: result.todos }));
				saveLocal(tripId, result.todos);
				setMeta(tripId, result.updatedAt);
			}
		} catch {
			// offline
		}
	}

	return {
		subscribe,

		/** Load local todos into store + async pull from server. Idempotent. */
		init(tripId: string) {
			const local = loadLocal(tripId);
			update((state) => ({ ...state, [tripId]: local }));
			pullFromServer(tripId);
		},

		get(tripId: string): Todo[] {
			return getTrip(tripId);
		},

		add(tripId: string, text: string) {
			const trimmed = text.trim();
			if (!trimmed) return;
			update((state) => {
				const next = [...(state[tripId] ?? []), { text: trimmed, done: false }];
				persistAndSync(tripId, next);
				return { ...state, [tripId]: next };
			});
		},

		updateText(tripId: string, index: number, text: string) {
			update((state) => {
				const cur = state[tripId] ?? [];
				if (index < 0 || index >= cur.length) return state;
				const next = [...cur];
				next[index] = { ...next[index], text };
				persistAndSync(tripId, next);
				return { ...state, [tripId]: next };
			});
		},

		toggle(tripId: string, index: number) {
			update((state) => {
				const cur = state[tripId] ?? [];
				if (index < 0 || index >= cur.length) return state;
				const next = [...cur];
				next[index] = { ...next[index], done: !next[index].done };
				persistAndSync(tripId, next);
				return { ...state, [tripId]: next };
			});
		},

		remove(tripId: string, index: number) {
			update((state) => {
				const cur = state[tripId] ?? [];
				if (index < 0 || index >= cur.length) return state;
				const next = cur.filter((_, i) => i !== index);
				persistAndSync(tripId, next);
				return { ...state, [tripId]: next };
			});
		},

		move(tripId: string, index: number, direction: 'up' | 'down') {
			update((state) => {
				const cur = state[tripId] ?? [];
				const newIndex = direction === 'up' ? index - 1 : index + 1;
				if (index < 0 || index >= cur.length || newIndex < 0 || newIndex >= cur.length) return state;
				const next = [...cur];
				const [item] = next.splice(index, 1);
				next.splice(newIndex, 0, item);
				persistAndSync(tripId, next);
				return { ...state, [tripId]: next };
			});
		}
	};
}

export const todosStore = createTodosStore();
