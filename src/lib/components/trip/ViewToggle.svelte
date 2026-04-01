<script lang="ts">
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	export let activeView: 'week' | 'day' = 'week';
	export let tripId: string;

	const dispatch = createEventDispatcher();
	const STORAGE_KEY_PREFIX = 'hw-trip-view-';

	onMount(() => {
		const saved = localStorage.getItem(STORAGE_KEY_PREFIX + tripId);
		if (saved === 'week' || saved === 'day') {
			activeView = saved;
		}
	});

	function setView(view: 'week' | 'day') {
		activeView = view;
		localStorage.setItem(STORAGE_KEY_PREFIX + tripId, view);
		dispatch('change', view);
	}
</script>

<div class="view-toggle" role="tablist">
	<button
		role="tab"
		aria-selected={activeView === 'week'}
		class="view-toggle-btn"
		class:active={activeView === 'week'}
		on:click={() => setView('week')}
	>
		Week
	</button>
	<button
		role="tab"
		aria-selected={activeView === 'day'}
		class="view-toggle-btn"
		class:active={activeView === 'day'}
		on:click={() => setView('day')}
	>
		Day
	</button>
</div>

<style>
	.view-toggle {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.view-toggle-btn {
		padding: 0.5rem 1.25rem;
		font-family: var(--font-display);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease;
		min-width: 44px;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.view-toggle-btn:hover {
		background: var(--accent-muted);
	}
	.view-toggle-btn.active {
		background: var(--accent);
		color: var(--surface);
	}
</style>
