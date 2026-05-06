import { writable, get } from 'svelte/store';
import type { Todo } from '$lib/types/trip';
import { dbGet, dbPut, dbDelete, dbGetAll } from '$lib/stores/db';

type TodosByTrip = Record<string, Todo[]>;

const SYNC_DEBOUNCE_MS = 2000;
const isBrowser = typeof window !== 'undefined';

/** Ensure every todo has an ID. */
function ensureId(todo: Todo): Todo {
	if (todo.id) return todo;
	return { ...todo, id: crypto.randomUUID() };
}

/** IndexedDB key for a per-todo record. */
function idbKey(tripId: string, todoId: string): string {
	return `${tripId}:${todoId}`;
}

function createTodosStore() {
	const { subscribe, update } = writable<TodosByTrip>({});
	const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function getTrip(tripId: string): Todo[] {
		return get({ subscribe })[tripId] ?? [];
	}

	// ── Per-entry persistence ─────────────────────────────────

	function persistTodo(tripId: string, todo: Todo) {
		if (!isBrowser || !todo.id) return;
		dbPut('todos', idbKey(tripId, todo.id), todo).catch(() => {});
		scheduleTodoSync(tripId, todo.id);
	}

	function scheduleTodoSync(tripId: string, todoId: string) {
		const key = `${tripId}:${todoId}`;
		const existing = syncTimers.get(key);
		if (existing) clearTimeout(existing);
		syncTimers.set(key, setTimeout(() => {
			syncTimers.delete(key);
			pushTodoToServer(tripId, todoId);
		}, SYNC_DEBOUNCE_MS));
	}

	async function pushTodoToServer(tripId: string, todoId: string) {
		try {
			const { saveTodoEntry } = await import('$lib/services/trips-api');
			const todos = getTrip(tripId);
			const idx = todos.findIndex((t) => t.id === todoId);
			if (idx === -1) return;
			const todo = todos[idx];
			const result = await saveTodoEntry(tripId, todoId, { text: todo.text, done: todo.done }, idx, todo.version ?? null);
			if (result.ok) {
				update((state) => {
					const cur = state[tripId] ?? [];
					const i = cur.findIndex((t) => t.id === todoId);
					if (i !== -1) {
						const next = [...cur];
						next[i] = { ...next[i], version: result.version };
						dbPut('todos', idbKey(tripId, todoId), next[i]).catch(() => {});
						return { ...state, [tripId]: next };
					}
					return state;
				});
			}
		} catch {
			// offline
		}
	}

	async function pushNewTodoToServer(tripId: string, todo: Todo, sortOrder: number) {
		try {
			const { createTodoEntry } = await import('$lib/services/trips-api');
			const result = await createTodoEntry(tripId, { text: todo.text, done: todo.done }, sortOrder);
			if (result.ok) {
				update((state) => {
					const cur = state[tripId] ?? [];
					const i = cur.findIndex((t) => t.id === todo.id);
					if (i !== -1) {
						const next = [...cur];
						// Update with server-assigned ID and version
						const oldId = next[i].id;
						next[i] = { ...next[i], id: result.todoId, version: result.version };
						// Update IndexedDB key if ID changed
						if (oldId && oldId !== result.todoId) {
							dbDelete('todos', idbKey(tripId, oldId)).catch(() => {});
						}
						dbPut('todos', idbKey(tripId, result.todoId), next[i]).catch(() => {});
						return { ...state, [tripId]: next };
					}
					return state;
				});
			}
		} catch {
			// offline — local ID persists, will retry
		}
	}

	async function pullFromServer(tripId: string) {
		try {
			const { fetchTodoEntries } = await import('$lib/services/trips-api');
			const result = await fetchTodoEntries(tripId);
			if (!result.entries.length) {
				// Server has no todos — check if we have local ones to push
				const local = getTrip(tripId);
				if (local.length > 0) {
					for (let i = 0; i < local.length; i++) {
						pushNewTodoToServer(tripId, local[i], i);
					}
				}
				return;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const serverTodos: Todo[] = result.entries.map((e: any) => ({
				text: e.text,
				done: e.done,
				id: e.todo_id || e._todo_id || e.id,
				version: e._version ?? e.version
			}));

			update((state) => {
				const merged = [...serverTodos];

				// Save all to IndexedDB
				for (const todo of merged) {
					if (todo.id) {
						dbPut('todos', idbKey(tripId, todo.id), todo).catch(() => {});
					}
				}
				return { ...state, [tripId]: merged };
			});
		} catch {
			// Offline — no server data available
		}
	}

	return {
		subscribe,

		async init(tripId: string) {
			// Load from IndexedDB — try per-entry keys, fall back to blob
			const allRows = await dbGetAll<Todo>('todos');
			const prefix = `${tripId}:`;
			const perEntryRows = allRows.filter((r) => r.key.startsWith(prefix));

			let todos: Todo[];
			if (perEntryRows.length > 0) {
				todos = perEntryRows.map((r) => ensureId(r.value));
			} else {
				// Fall back to old blob key
				const blob = await dbGet<Todo[]>('todos', tripId);
				todos = blob ? blob.map(ensureId) : [];
				// Migrate to per-entry keys
				if (todos.length > 0) {
					for (const t of todos) {
						if (t.id) await dbPut('todos', idbKey(tripId, t.id), t);
					}
					await dbDelete('todos', tripId);
				}
			}

			update((state) => ({ ...state, [tripId]: todos }));
			pullFromServer(tripId);
		},

		get(tripId: string): Todo[] {
			return getTrip(tripId);
		},

		add(tripId: string, text: string) {
			const trimmed = text.trim();
			if (!trimmed) return;
			const todo = ensureId({ text: trimmed, done: false });
			update((state) => {
				const next = [...(state[tripId] ?? []), todo];
				dbPut('todos', idbKey(tripId, todo.id!), todo).catch(() => {});
				return { ...state, [tripId]: next };
			});
			pushNewTodoToServer(tripId, todo, getTrip(tripId).length);
		},

		updateText(tripId: string, index: number, text: string) {
			update((state) => {
				const cur = state[tripId] ?? [];
				if (index < 0 || index >= cur.length) return state;
				const next = [...cur];
				next[index] = { ...ensureId(next[index]), text };
				persistTodo(tripId, next[index]);
				return { ...state, [tripId]: next };
			});
		},

		toggle(tripId: string, index: number) {
			update((state) => {
				const cur = state[tripId] ?? [];
				if (index < 0 || index >= cur.length) return state;
				const next = [...cur];
				next[index] = { ...ensureId(next[index]), done: !next[index].done };
				persistTodo(tripId, next[index]);
				return { ...state, [tripId]: next };
			});
		},

		remove(tripId: string, index: number) {
			const cur = getTrip(tripId);
			if (index < 0 || index >= cur.length) return;
			const todo = cur[index];

			update((state) => {
				const next = (state[tripId] ?? []).filter((_, i) => i !== index);
				return { ...state, [tripId]: next };
			});

			// Tombstone on server
			if (todo.id && todo.version) {
				import('$lib/services/trips-api').then(({ deleteTodoEntry }) => {
					deleteTodoEntry(tripId, todo.id!, todo.version!).catch(() => {});
				});
			}
			if (todo.id) {
				dbDelete('todos', idbKey(tripId, todo.id)).catch(() => {});
			}
		},

		move(tripId: string, index: number, direction: 'up' | 'down') {
			update((state) => {
				const cur = state[tripId] ?? [];
				const newIndex = direction === 'up' ? index - 1 : index + 1;
				if (index < 0 || index >= cur.length || newIndex < 0 || newIndex >= cur.length) return state;
				const next = [...cur];
				const [item] = next.splice(index, 1);
				next.splice(newIndex, 0, item);
				// Re-sync sort orders for both moved items
				persistTodo(tripId, next[index]);
				persistTodo(tripId, next[newIndex]);
				return { ...state, [tripId]: next };
			});
		}
	};
}

export const todosStore = createTodosStore();
