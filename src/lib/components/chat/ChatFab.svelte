<script lang="ts">
	import { chat } from '$lib/stores/chat';
	import { trips } from '$lib/stores/trips';
	import { page } from '$app/stores';

	$: tripId = $page.params.id || 'china-2026';
	$: trip = $trips[tripId];

	function handleClick() {
		if (trip) {
			chat.toggle(tripId, trip);
		}
	}
</script>

{#if trip}
	<button class="fab" class:fab--open={$chat.isOpen} on:click={handleClick} aria-label="Trip assistant">
		{#if $chat.isOpen}
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		{:else}
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
			</svg>
		{/if}
	</button>
{/if}

<style>
	.fab {
		position: fixed;
		bottom: 1.5rem;
		left: 1.5rem;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--surface);
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 16px rgba(184, 110, 43, 0.35);
		z-index: 45;
		transition: background-color 150ms ease, transform 100ms ease, box-shadow 150ms ease;
	}

	.fab:hover {
		background: var(--accent-hover);
		box-shadow: 0 6px 20px rgba(184, 110, 43, 0.45);
	}

	.fab:active {
		transform: scale(0.94);
	}

	.fab--open {
		background: var(--ink-muted);
		box-shadow: 0 4px 12px rgba(61, 43, 31, 0.2);
	}

	.fab--open:hover {
		background: var(--ink);
	}

	/* On desktop, keep FAB on the left even when chat sidebar opens */
</style>
