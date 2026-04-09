<script lang="ts">
	import type { TripDay } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';
	import { createEventDispatcher } from 'svelte';

	export let day: TripDay;
	export let dayIndex: number;
	export let tripId: string;
	export let isToday = false;

	const dispatch = createEventDispatcher();

	let editingField: string | null = null;
	let editValue = '';

	function startEdit(field: string) {
		editingField = field;
		editValue = String((day as unknown as Record<string, unknown>)[field] ?? '');
	}

	function commitEdit() {
		if (!editingField) return;
		trips.updateDayField(tripId, dayIndex, editingField as keyof TripDay, editValue);
		editingField = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
		else if (e.key === 'Escape') { editingField = null; }
	}

	function formatDate(d: string) {
		return d ? d.slice(5) : '';
	}

	$: hasActivities = day.morning || day.afternoon || day.evening;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="day-card card p-4"
	class:day-card--today={isToday}
	class:day-card--ooo={day.ooo}
	on:click={() => dispatch('select', dayIndex)}
>
	<!-- Row 1: Date + Location -->
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-2 min-w-0">
			<span class="text-xs font-medium whitespace-nowrap" style="color: var(--ink-muted)">
				{day.dayOfWeek} {formatDate(day.date)}
			</span>
			{#if day.ooo}
				<span class="badge badge-warn text-xs">OOO</span>
			{/if}
		</div>
		{#if editingField === 'location'}
			<input
				type="text" bind:value={editValue}
				on:blur={commitEdit} on:keydown={handleKeydown}
				class="input-themed text-sm py-0.5 px-2 text-right flex-1"
			/>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="font-semibold text-sm truncate cursor-text"
				on:click|stopPropagation={() => startEdit('location')}
				title={day.location || 'Tap to add location'}
			>
				{day.location || '\u2014'}
			</span>
		{/if}
	</div>

	<!-- Row 2: Travel + Accommodation (only if present) -->
	{#if day.travel || day.accommodation}
		<div class="flex gap-3 mt-2 text-xs" style="color: var(--ink-muted)">
			{#if day.travel}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<span class="truncate cursor-text" on:click|stopPropagation={() => startEdit('travel')} title={day.travel}>
					{'\u2708'} {day.travel}
				</span>
			{/if}
			{#if day.accommodation}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<span class="truncate cursor-text ml-auto" on:click|stopPropagation={() => startEdit('accommodation')} title={day.accommodation}>
					{'\u{1F3E8}'} {day.accommodation}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Row 3: AM / PM / EVE -->
	{#if hasActivities}
		<div class="grid grid-cols-3 gap-2 mt-2 text-xs" style="color: var(--ink-faint)">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="truncate cursor-text" on:click|stopPropagation={() => startEdit('morning')} title={day.morning || 'Morning'}>
				<span style="color: var(--ink-muted)">AM</span> {day.morning || '\u2014'}
			</span>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="truncate cursor-text" on:click|stopPropagation={() => startEdit('afternoon')} title={day.afternoon || 'Afternoon'}>
				<span style="color: var(--ink-muted)">PM</span> {day.afternoon || '\u2014'}
			</span>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="truncate cursor-text" on:click|stopPropagation={() => startEdit('evening')} title={day.evening || 'Evening'}>
				<span style="color: var(--ink-muted)">EVE</span> {day.evening || '\u2014'}
			</span>
		</div>
	{/if}

	<!-- Row 4: Notes (only if present) -->
	{#if day.notes}
		<p class="mt-2 text-xs truncate" style="color: var(--ink-faint)" title={day.notes}>
			{day.notes}
		</p>
	{/if}

	<!-- Inline edit overlay for non-location fields -->
	{#if editingField && editingField !== 'location'}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="mt-2" on:click|stopPropagation>
			<label class="section-label text-xs block mb-1">{editingField}</label>
			<input
				type="text" bind:value={editValue}
				on:blur={commitEdit} on:keydown={handleKeydown}
				class="input-themed text-sm py-1 w-full"
			/>
		</div>
	{/if}
</div>

<style>
	.day-card {
		cursor: pointer;
		transition: border-color 200ms ease, box-shadow 200ms ease, transform 100ms ease;
	}
	.day-card:active {
		transform: scale(0.99);
	}
	.day-card--today {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.day-card--ooo {
		opacity: 0.7;
	}
</style>
