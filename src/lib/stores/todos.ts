import { writable, get } from 'svelte/store';

export interface Todo {
	text: string;
	done: boolean;
}

type TodosByTrip = Record<string, Todo[]>;

const TODOS_KEY_PREFIX = 'hw-trip-todos-';
const META_KEY = 'hw-todos-meta';
const SYNC_DEBOUNCE_MS = 2000;

function getDefaultTodos(): Todo[] {
	return [
		{ text: 'Book intra-China train/flights', done: false },
		{ text: 'Fill in morning/afternoon activities', done: false },
		{ text: 'Confirm Wulingyuan hotel', done: false }
	];
}

function loadLocal(tripId: string): Todo[] {
	if (typeof localStorage === 'undefined') return getDefaultTodos();
	const raw = localStorage.getItem(TODOS_KEY_PREFIX + tripId);
	if (!raw) return getDefaultTodos();
	try {
		return JSON.parse(raw) as Todo[];
	} catch {
		return getDefaultTodos();
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
				// No server row — push local (migration)
				const now = new Date().toISOString();
				const todos = getTrip(tripId);
				const saveResult = await saveTodos(tripId, todos, now);
				if (saveResult.ok) setMeta(tripId, saveResult.updatedAt);
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
