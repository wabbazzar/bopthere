<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { getProfile } from '$lib/data/destination-vibes';

	export let location: string;
	export let slot: string;
	export let anchor: HTMLElement | null = null;

	const dispatch = createEventDispatcher();
	const profile = getProfile(location);

	const energyOptions = ['chill', 'active', 'adventure'];
	const interestOptions = ['culture', 'nature', 'food', 'art'];

	let selectedEnergy = 'active';
	let selectedInterest = profile.defaultInterest;
	let popoverEl: HTMLElement;

	// Position below anchor
	let style = '';
	onMount(() => {
		if (anchor && popoverEl) {
			const rect = anchor.getBoundingClientRect();
			const popRect = popoverEl.getBoundingClientRect();
			let top = rect.bottom + 6;
			let left = rect.left;

			// Keep within viewport
			if (top + popRect.height > window.innerHeight - 20) {
				top = rect.top - popRect.height - 6;
			}
			if (left + popRect.width > window.innerWidth - 12) {
				left = window.innerWidth - popRect.width - 12;
			}
			if (left < 12) left = 12;

			style = `top: ${top}px; left: ${left}px;`;
		}
	});

	function handleChipClick(type: 'energy' | 'interest', value: string) {
		if (type === 'energy') selectedEnergy = value;
		else selectedInterest = value;
	}

	function submit() {
		dispatch('submit', { energy: selectedEnergy, interest: selectedInterest });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') dispatch('close');
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="popover-backdrop" on:click={() => dispatch('close')}></div>

<div class="popover" bind:this={popoverEl} {style}>
	<p class="popover-label">Energy</p>
	<div class="chips">
		{#each energyOptions as opt}
			<button
				class="chip"
				class:chip--selected={selectedEnergy === opt}
				on:click={() => handleChipClick('energy', opt)}
			>{opt}</button>
		{/each}
	</div>

	<p class="popover-label">Interest</p>
	<div class="chips">
		{#each interestOptions as opt}
			<button
				class="chip"
				class:chip--selected={selectedInterest === opt}
				on:click={() => handleChipClick('interest', opt)}
			>{opt}</button>
		{/each}
	</div>

	<button class="go-btn" on:click={submit}>
		Suggest {slot} &rarr;
	</button>
</div>

<style>
	.popover-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
	}

	.popover {
		position: fixed;
		z-index: 56;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 4px 20px rgba(61, 43, 31, 0.12);
		padding: 0.75rem;
		max-width: 260px;
		width: max-content;
	}

	.popover-label {
		font-family: var(--font-display);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		margin-bottom: 0.375rem;
	}

	.popover-label:not(:first-child) {
		margin-top: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.chip {
		font-family: var(--font-body);
		font-size: 0.72rem;
		padding: 0.3rem 0.6rem;
		border-radius: 1rem;
		border: 1px solid var(--border);
		background: var(--surface-alt);
		color: var(--ink-muted);
		cursor: pointer;
		transition: all 120ms ease;
		text-transform: capitalize;
		min-height: 1.75rem;
	}

	.chip:hover {
		border-color: var(--border-strong);
	}

	.chip--selected {
		background: var(--accent-muted);
		color: var(--accent);
		border-color: var(--accent);
	}

	.go-btn {
		display: block;
		width: 100%;
		margin-top: 0.625rem;
		padding: 0.4rem 0;
		font-family: var(--font-body);
		font-size: 0.75rem;
		border-radius: var(--radius);
		border: none;
		background: var(--accent);
		color: var(--surface);
		cursor: pointer;
		transition: background-color 150ms ease;
		text-transform: capitalize;
	}

	.go-btn:hover {
		background: var(--accent-hover);
	}
</style>
