<script lang="ts">
	import { onMount } from 'svelte';
	import { todosStore } from '$lib/stores/todos';

	export let tripId: string;

	let editingTodoIndex: number | null = null;
	let editTodoValue = '';
	let newTodoValue = '';

	onMount(() => { todosStore.init(tripId); });

	// Re-init whenever the active trip id changes so we load the right todos.
	$: if (tripId) todosStore.init(tripId);

	$: todos = $todosStore[tripId] ?? [];

	function startTodoEdit(index: number) {
		editingTodoIndex = index;
		editTodoValue = todos[index].text;
	}

	function commitTodoEdit() {
		if (editingTodoIndex === null) return;
		todosStore.updateText(tripId, editingTodoIndex, editTodoValue);
		editingTodoIndex = null;
	}

	function handleTodoKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitTodoEdit(); }
		else if (e.key === 'Escape') { editingTodoIndex = null; }
	}

	function addTodo() {
		if (!newTodoValue.trim()) return;
		todosStore.add(tripId, newTodoValue);
		newTodoValue = '';
	}

	function handleNewTodoKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); addTodo(); }
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
				<input type="checkbox" checked={todo.done} on:change={() => todosStore.toggle(tripId, i)}
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
						<button aria-label="Move up" on:click={() => todosStore.move(tripId, i, 'up')} style="background:none;border:none;cursor:pointer;color:inherit">{'\u25B2'}</button>
					{/if}
					{#if i < todos.length - 1}
						<button aria-label="Move down" on:click={() => todosStore.move(tripId, i, 'down')} style="background:none;border:none;cursor:pointer;color:inherit">{'\u25BC'}</button>
					{/if}
					<button aria-label="Delete todo" on:click={() => todosStore.remove(tripId, i)} style="background:none;border:none;cursor:pointer;color:var(--danger)">{'\u2715'}</button>
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
