<script lang="ts">
	import type { Trip } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';

	export let trip: Trip;
	export let tripId: string;

	let editingField: string | null = null;
	let editValue = '';

	function startEdit(field: string) {
		editingField = field;
		editValue = String((trip as unknown as Record<string, unknown>)[field] ?? '');
	}

	function commitEdit() {
		if (!editingField) return;
		trips.updateTrip(tripId, editingField as 'name' | 'startDate' | 'endDate', editValue);
		editingField = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
		else if (e.key === 'Escape') { editingField = null; }
	}

	function undo() { trips.undo(); }
	function resetTrip() {
		if (confirm('Reset all itinerary changes to defaults? This cannot be undone.')) {
			trips.resetTrip(tripId);
		}
	}
	function exportTrip() {
		const json = trips.exportTrip(tripId);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = `${tripId}.json`; a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="mb-4">
	<div class="flex items-center justify-between mb-2">
		<a href="/dashboard" class="text-sm">{'\u2190'} Back to trips</a>
		<div class="flex gap-3 text-sm">
			<button on:click={undo} style="color: var(--ink-muted); background: none; border: none; cursor: pointer; font-family: var(--font-body)">Undo</button>
			<button on:click={exportTrip} style="color: var(--ink-muted); background: none; border: none; cursor: pointer; font-family: var(--font-body)">Export</button>
			<button on:click={resetTrip} style="color: var(--danger); background: none; border: none; cursor: pointer; font-family: var(--font-body)">Reset</button>
		</div>
	</div>

	{#if editingField === 'name'}
		<input
			type="text"
			bind:value={editValue}
			on:blur={commitEdit}
			on:keydown={handleKeydown}
			class="font-display text-2xl md:text-3xl font-semibold w-full bg-transparent"
			style="border: none; border-bottom: 2px solid var(--accent); outline: none; color: var(--ink)"
		/>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<h1
			class="font-display text-2xl md:text-3xl font-semibold cursor-text"
			on:click={() => startEdit('name')}
			title="Tap to edit"
		>
			{trip.name}
		</h1>
	{/if}

	<p class="mt-1 text-sm" style="color: var(--ink-muted)">
		{trip.startDate} {'\u2192'} {trip.endDate} {'\u00B7'} {trip.destinations.join(', ')}
	</p>
</div>
