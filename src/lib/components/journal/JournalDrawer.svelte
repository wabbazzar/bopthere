<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { TripDay, JournalEntry } from '$lib/types/trip';
	import { journalStore } from '$lib/stores/journal';
	import ItineraryChecklist from './ItineraryChecklist.svelte';
	import JournalBlocks from './JournalBlocks.svelte';
	import JournalHeader from './JournalHeader.svelte';

	export let open = false;
	export let tripId: string;
	export let dayIndex: number;
	export let day: TripDay;
	export let totalDays: number;

	const dispatch = createEventDispatcher<{ close: void }>();

	let entry: JournalEntry | undefined;
	let drawerEl: HTMLDivElement | undefined;

	// Touch-to-dismiss state
	let dragStartY = 0;
	let dragOffset = 0;
	let dragging = false;

	$: if (open && day) {
		entry = journalStore.createOrHydrate(tripId, dayIndex, day);
	}

	// Re-read from store when it updates
	$: if (open) {
		const storeEntries = $journalStore[tripId] ?? [];
		const found = storeEntries.find((e) => e.dayIndex === dayIndex);
		if (found) entry = found;
	}

	function close() {
		dragOffset = 0;
		dragging = false;
		dispatch('close');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}

	// Swipe-down to dismiss
	function onDragStart(e: TouchEvent) {
		dragStartY = e.touches[0].clientY;
		dragging = true;
		dragOffset = 0;
	}

	function onDragMove(e: TouchEvent) {
		if (!dragging) return;
		const dy = e.touches[0].clientY - dragStartY;
		dragOffset = Math.max(0, dy);
	}

	function onDragEnd() {
		if (!dragging) return;
		if (dragOffset > 100) {
			close();
		} else {
			dragOffset = 0;
		}
		dragging = false;
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const [, m, d] = dateStr.split('-');
		return `${m}/${d}`;
	}
</script>

<svelte:window on:keydown={handleEscape} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="journal-backdrop" on:click={handleBackdropClick}>
		<div
			class="journal-drawer"
			bind:this={drawerEl}
			style:transform={dragOffset > 0 ? `translateY(${dragOffset}px)` : ''}
			style:transition={dragging ? 'none' : 'transform 200ms ease-out'}
			role="dialog"
			aria-label="Journal for Day {dayIndex + 1}"
		>
			<!-- Drag handle -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="drag-handle-area"
				on:touchstart={onDragStart}
				on:touchmove={onDragMove}
				on:touchend={onDragEnd}
			>
				<div class="drag-handle"></div>
			</div>

			<!-- Title row -->
			<div class="drawer-title-row">
				<div class="drawer-title">
					<span class="drawer-title-day">Day {dayIndex + 1} of {totalDays}</span>
					<span class="drawer-title-detail">
						{day.location || 'No location'} {'\u00B7'} {day.dayOfWeek} {formatDate(day.date)}
					</span>
				</div>
				<button class="close-btn" on:click={close} aria-label="Close journal">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
						<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
				</button>
			</div>

			<!-- Scrollable content -->
			<div class="drawer-content">
				{#if entry}
					<JournalHeader
						{tripId}
						{dayIndex}
						mood={entry.mood}
						weather={entry.weather}
					/>

					<ItineraryChecklist
						{tripId}
						{dayIndex}
						itinerary={entry.itinerary}
					/>

					<JournalBlocks
						{tripId}
						{dayIndex}
						blocks={entry.blocks}
					/>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.journal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgba(61, 43, 31, 0.35);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		animation: fade-in 160ms ease-out;
	}

	.journal-drawer {
		background: var(--surface);
		border-radius: 1rem 1rem 0 0;
		width: 100%;
		max-width: 600px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -8px 30px rgba(61, 43, 31, 0.2);
		animation: slide-up 200ms ease-out;
	}

	.drag-handle-area {
		padding: 0.75rem 0 0.25rem;
		display: flex;
		justify-content: center;
		cursor: grab;
		touch-action: none;
	}

	.drag-handle {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: var(--border);
	}

	.drawer-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 0.25rem 1rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.drawer-title {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.drawer-title-day {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink);
	}

	.drawer-title-detail {
		font-size: 0.8rem;
		color: var(--ink-muted);
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--ink-muted);
		padding: 0.25rem;
		border-radius: var(--radius);
		min-width: 36px;
		min-height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 150ms ease, background 150ms ease;
	}

	.close-btn:hover {
		color: var(--ink);
		background: var(--accent-muted);
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem 1rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slide-up {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>
