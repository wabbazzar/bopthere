import { writable, get } from 'svelte/store';
import { dbGet, dbPut } from '$lib/stores/db';

export interface Todo {
	text: string;
	done: boolean;
}

type TodosByTrip = Record<string, Todo[]>;

const SYNC_DEBOUNCE_MS = 2000;

function createTodosStore() {
	const { subscribe, update, set: _set } = writable<TodosByTrip>({});
	const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function getTrip(tripId: string): Todo[] {
		return get({ subscribe })[tripId] ?? [];
	}

	function persistAndSync(tripId: string, next: Todo[]) {
		dbPut('todos', tripId, next).catch(() => {});
		const now = new Date().toISOString();
		setMeta(tripId, now);
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

	async function loadMeta(): Promise<Record<string, string>> {
		return (await dbGet<Record<string, string>>('meta', 'hw-todos-meta')) ?? {};
	}

	function setMeta(tripId: string, ts: string) {
		loadMeta().then((m) => {
			m[tripId] = ts;
			dbPut('meta', 'hw-todos-meta', m).catch(() => {});
		});
	}

	async function pushToServer(tripId: string) {
		try {
			const { saveTodos } = await import('$lib/services/trips-api');
			const todos = getTrip(tripId);
			const meta = await loadMeta();
			const updatedAt = meta[tripId] || new Date().toISOString();
			const result = await saveTodos(tripId, todos, updatedAt);
			if (result.ok) {
				setMeta(tripId, result.updatedAt);
			} else if (result.serverTodos) {
				update((state) => ({ ...state, [tripId]: result.serverTodos! }));
				dbPut('todos', tripId, result.serverTodos).catch(() => {});
				setMeta(tripId, result.updatedAt);
			}
		} catch {
			// offline — IndexedDB has latest
		}
	}

	async function pullFromServer(tripId: string) {
		try {
			const { fetchTodos, saveTodos } = await import('$lib/services/trips-api');
			const result = await fetchTodos(tripId);
			const meta = await loadMeta();
			const localTs = meta[tripId] || '';
			if (result.updatedAt === null) {
				if (localTs) {
					const todos = getTrip(tripId);
					const saveResult = await saveTodos(tripId, todos, localTs);
					if (saveResult.ok) setMeta(tripId, saveResult.updatedAt);
				} else {
					update((state) => ({ ...state, [tripId]: [] }));
					dbPut('todos', tripId, []).catch(() => {});
				}
			} else if (!localTs || result.updatedAt > localTs) {
				update((state) => ({ ...state, [tripId]: result.todos }));
				dbPut('todos', tripId, result.todos).catch(() => {});
				setMeta(tripId, result.updatedAt);
			}
		} catch {
			// offline
		}
	}

	return {
		subscribe,

		/** Load local todos into store + async pull from server. */
		async init(tripId: string) {
			const local = (await dbGet<Todo[]>('todos', tripId)) ?? [];
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
