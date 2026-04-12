<script lang="ts">
	import { onMount } from 'svelte';

	export let tripId: string;

	let todos: { text: string; done: boolean }[] = [];
	let editingTodoIndex: number | null = null;
	let editTodoValue = '';
	let newTodoValue = '';
	const TODOS_KEY_PREFIX = 'hw-trip-todos-';
	const META_KEY = 'hw-todos-meta';
	const SYNC_DEBOUNCE_MS = 2000;
	let syncTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => { loadTodos(); });

	$: if (tripId) loadTodos();

	function loadTodos() {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(TODOS_KEY_PREFIX + tripId);
		if (raw) {
			try { todos = JSON.parse(raw); }
			catch { todos = getDefaultTodos(); }
		} else {
			todos = getDefaultTodos();
		}
		// Async: pull server version
		pullTodosFromServer();
	}

	function getDefaultTodos() {
		return [
			{ text: 'Book intra-China train/flights', done: false },
			{ text: 'Fill in morning/afternoon activities', done: false },
			{ text: 'Confirm Wulingyuan hotel', done: false }
		];
	}

	function getUpdatedAt(): string {
		try { return JSON.parse(localStorage.getItem(META_KEY) || '{}')[tripId] || ''; }
		catch { return ''; }
	}
	function setUpdatedAt(ts: string) {
		try {
			const m = JSON.parse(localStorage.getItem(META_KEY) || '{}');
			m[tripId] = ts;
			localStorage.setItem(META_KEY, JSON.stringify(m));
		} catch { /* ignore */ }
	}

	function saveTodos() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(TODOS_KEY_PREFIX + tripId, JSON.stringify(todos));
		const now = new Date().toISOString();
		setUpdatedAt(now);
		scheduleSyncToServer();
	}

	function scheduleSyncToServer() {
		if (syncTimer) clearTimeout(syncTimer);
		syncTimer = setTimeout(() => { syncTimer = null; pushTodosToServer(); }, SYNC_DEBOUNCE_MS);
	}

	async function pushTodosToServer() {
		try {
			const { saveTodos: apiSave } = await import('$lib/services/trips-api');
			const result = await apiSave(tripId, todos, getUpdatedAt() || new Date().toISOString());
			if (result.ok) {
				setUpdatedAt(result.updatedAt);
			} else if (result.serverTodos) {
				todos = result.serverTodos;
				if (typeof localStorage !== 'undefined') localStorage.setItem(TODOS_KEY_PREFIX + tripId, JSON.stringify(todos));
				setUpdatedAt(result.updatedAt);
			}
		} catch { /* offline — localStorage has the latest, will sync on next save */ }
	}

	async function pullTodosFromServer() {
		try {
			const { fetchTodos, saveTodos: apiSave } = await import('$lib/services/trips-api');
			const result = await fetchTodos(tripId);
			const localTs = getUpdatedAt();
			if (result.updatedAt === null) {
				// No server row — push local (migration)
				const now = new Date().toISOString();
				const saveResult = await apiSave(tripId, todos, now);
				if (saveResult.ok) setUpdatedAt(saveResult.updatedAt);
			} else if (!localTs || result.updatedAt > localTs) {
				// Server is newer
				todos = result.todos;
				if (typeof localStorage !== 'undefined') localStorage.setItem(TODOS_KEY_PREFIX + tripId, JSON.stringify(todos));
				setUpdatedAt(result.updatedAt);
			}
		} catch { /* offline */ }
	}

	function toggleTodo(index: number) { todos[index].done = !todos[index].done; todos = [...todos]; saveTodos(); }
	function startTodoEdit(index: number) { editingTodoIndex = index; editTodoValue = todos[index].text; }
	function commitTodoEdit() {
		if (editingTodoIndex === null) return;
		todos[editingTodoIndex].text = editTodoValue;
		todos = [...todos]; saveTodos(); editingTodoIndex = null;
	}
	function handleTodoKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitTodoEdit(); }
		else if (e.key === 'Escape') { editingTodoIndex = null; }
	}
	function deleteTodo(index: number) { todos.splice(index, 1); todos = [...todos]; saveTodos(); }
	function addTodo() {
		if (!newTodoValue.trim()) return;
		todos = [...todos, { text: newTodoValue.trim(), done: false }]; saveTodos(); newTodoValue = '';
	}
	function handleNewTodoKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); addTodo(); }
	}
	function moveTodoUp(index: number) {
		if (index === 0) return;
		const item = todos.splice(index, 1)[0]; todos.splice(index - 1, 0, item); todos = [...todos]; saveTodos();
	}
	function moveTodoDown(index: number) {
		if (index >= todos.length - 1) return;
		const item = todos.splice(index, 1)[0]; todos.splice(index + 1, 0, item); todos = [...todos]; saveTodos();
	}
</script>

<div class="card p-5">
	<p class="section-label mb-3">
		To Do
		{#if todos.length > 0}
			<span class="todo-count">{todos.filter((t) => t.done).length}/{todos.length}</span>
		{/if}
	</p>

	{#if todos.length > 0}
		<div class="w-full h-1 rounded-full mb-3" style="background: var(--border)">
			<div
				class="h-1 rounded-full transition-all duration-300"
				style="background: var(--success); width: {(todos.filter(t => t.done).length / todos.length) * 100}%"
			></div>
		</div>
	{/if}

	<ul class="space-y-1.5 text-sm">
		{#each todos as todo, i}
			<li class="group flex items-center gap-2">
				<input type="checkbox" checked={todo.done} on:change={() => toggleTodo(i)}
					class="accent-[var(--success)]" />
				{#if editingTodoIndex === i}
					<input type="text" bind:value={editTodoValue} on:blur={commitTodoEdit}
						on:keydown={handleTodoKeydown} class="input-themed text-sm flex-1 py-0.5" />
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<span
						class="flex-1 cursor-text transition-colors"
						class:line-through={todo.done}
						style:color={todo.done ? 'var(--ink-faint)' : 'var(--ink)'}
						on:click={() => startTodoEdit(i)}
						title="Tap to edit"
					>
						{todo.text}
					</span>
				{/if}
				<span class="opacity-0 group-hover:opacity-100 flex gap-1 text-xs shrink-0" style="color: var(--ink-faint)">
					{#if i > 0}
						<button on:click={() => moveTodoUp(i)} style="background:none;border:none;cursor:pointer;color:inherit">{'\u25B2'}</button>
					{/if}
					{#if i < todos.length - 1}
						<button on:click={() => moveTodoDown(i)} style="background:none;border:none;cursor:pointer;color:inherit">{'\u25BC'}</button>
					{/if}
					<button on:click={() => deleteTodo(i)} style="background:none;border:none;cursor:pointer;color:var(--danger)">{'\u2715'}</button>
				</span>
			</li>
		{/each}
	</ul>

	<div class="mt-3 flex gap-2">
		<input type="text" bind:value={newTodoValue} on:keydown={handleNewTodoKeydown}
			placeholder="Add a task..." class="input-themed text-sm flex-1" />
		<button on:click={addTodo} class="btn-primary text-xs px-3 py-1">Add</button>
	</div>
</div>

<style>
	.todo-count {
		margin-left: 0.5rem;
		font-family: var(--font-body);
		font-size: 0.7rem;
		font-weight: 400;
		letter-spacing: 0.02em;
		text-transform: none;
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}
</style>
