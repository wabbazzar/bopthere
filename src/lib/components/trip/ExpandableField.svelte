<script lang="ts">
	import { trips } from '$lib/stores/trips';
	import type { TripDay } from '$lib/types/trip';

	export let label: string;
	export let value: string;
	export let field: string;
	export let dayIndex: number;
	export let tripId: string;
	export let icon = '';

	let expanded = false;
	let editing = false;
	let editValue = '';

	$: isLong = value.length > 40;
	$: displayValue = value || '\u2014';

	function toggle() {
		if (isLong) expanded = !expanded;
	}

	function startEdit() {
		editing = true;
		editValue = value;
	}

	function commitEdit() {
		if (!editing) return;
		trips.updateDayField(tripId, dayIndex, field as keyof TripDay, editValue);
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
		else if (e.key === 'Escape') { editing = false; }
	}
</script>

<div class="field-row">
	<div class="field-label">
		{#if icon}<span class="field-icon">{icon}</span>{/if}
		{label}
	</div>

	<div class="field-value" class:field-value--empty={!value}>
		{#if editing}
			<input
				type="text"
				bind:value={editValue}
				on:blur={commitEdit}
				on:keydown={handleKeydown}
				class="input-themed text-sm py-1 w-full"
			/>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="field-text" class:truncate={!expanded && isLong} on:dblclick={startEdit} title="Double-click to edit">
				{displayValue}
			</div>
		{/if}
	</div>

	{#if isLong && !editing}
		<button class="field-chevron" on:click={toggle} aria-label={expanded ? 'Collapse' : 'Expand'}>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="transform: rotate({expanded ? '90deg' : '0deg'}); transition: transform 150ms ease">
				<path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.field-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr auto;
		align-items: start;
		gap: 0.5rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--border);
		min-height: 2.75rem;
	}
	.field-row:last-child {
		border-bottom: none;
	}
	.field-label {
		font-family: var(--font-display);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
		padding-top: 0.125rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.field-icon {
		font-style: normal;
		font-size: 0.8rem;
	}
	.field-value {
		font-size: 0.875rem;
		color: var(--ink);
		line-height: 1.4;
	}
	.field-value--empty {
		color: var(--ink-faint);
	}
	.field-text {
		cursor: text;
	}
	.field-chevron {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--ink-faint);
		padding: 0.25rem;
		min-width: 44px;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
