<script lang="ts">
	import { onMount } from 'svelte';

	export let tripId: string;

	let todos: { text: string; done: boolean }[] = [];
	let editingTodoIndex: number | null = null;
	let editTodoValue = '';
	let newTodoValue = '';
	const TODOS_KEY_PREFIX = 'hw-trip-todos-';

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
	}

	function getDefaultTodos() {
		return [
			{ text: 'Book intra-China train/flights', done: false },
			{ text: 'Fill in morning/afternoon activities', done: false },
			{ text: 'Confirm Wulingyuan hotel', done: false }
		];
	}

	function saveTodos() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(TODOS_KEY_PREFIX + tripId, JSON.stringify(todos));
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
	<div class="flex items-center justify-between mb-3">
		<p class="section-label">To Do</p>
		<span class="text-xs" style="color: var(--ink-faint)">
			{todos.filter((t) => t.done).length}/{todos.length}
		</span>
	</div>

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
						on:dblclick={() => startTodoEdit(i)}
						title="Double-click to edit"
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
