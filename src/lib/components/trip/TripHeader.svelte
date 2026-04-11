<script lang="ts">
	import type { Trip } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';

	export let trip: Trip;
	export let tripId: string;

	let editingField: string | null = null;
	let editValue = '';
	let menuOpen = false;

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

	function undo() { menuOpen = false; trips.undo(); }
	function resetTrip() {
		menuOpen = false;
		if (confirm('Reset all itinerary changes to defaults? This cannot be undone.')) {
			trips.resetTrip(tripId);
		}
	}
	function exportTrip() {
		menuOpen = false;
		const json = trips.exportTrip(tripId);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = `${tripId}.json`; a.click();
		URL.revokeObjectURL(url);
	}
	function toggleMenu(e: MouseEvent) { e.stopPropagation(); menuOpen = !menuOpen; }
	function closeMenu() { if (menuOpen) menuOpen = false; }

	function formatDateRange(start: string, end: string): string {
		if (!start || !end) return '';
		const s = new Date(start + 'T12:00:00');
		const e = new Date(end + 'T12:00:00');
		if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} \u2192 ${end}`;
		const sameYear = s.getFullYear() === e.getFullYear();
		const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
		const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
		if (sMonth === eMonth && sameYear) return `${sMonth} ${s.getDate()}\u2013${e.getDate()}, ${s.getFullYear()}`;
		if (sameYear) return `${sMonth} ${s.getDate()} \u2013 ${eMonth} ${e.getDate()}, ${s.getFullYear()}`;
		return `${sMonth} ${s.getDate()}, ${s.getFullYear()} \u2013 ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
	}

	$: dayCount = trip?.days?.length ?? 0;
</script>

<svelte:window on:click={closeMenu} />

<div class="trip-header">
	<div class="title-row">
		{#if editingField === 'name'}
			<input
				type="text"
				bind:value={editValue}
				on:blur={commitEdit}
				on:keydown={handleKeydown}
				class="title-input"
			/>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<h1
				class="trip-title"
				on:click={() => startEdit('name')}
				title="Tap to edit"
			>
				{trip.name}
			</h1>
		{/if}

		<div class="menu-wrap">
			<button
				type="button"
				class="menu-btn"
				aria-label="Trip actions"
				aria-expanded={menuOpen}
				aria-haspopup="menu"
				on:click={toggleMenu}
			>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<circle cx="5" cy="12" r="1.8" fill="currentColor" />
					<circle cx="12" cy="12" r="1.8" fill="currentColor" />
					<circle cx="19" cy="12" r="1.8" fill="currentColor" />
				</svg>
			</button>
			{#if menuOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="menu" role="menu" on:click|stopPropagation>
					<button type="button" role="menuitem" on:click={undo}>Undo</button>
					<button type="button" role="menuitem" on:click={exportTrip}>Export</button>
					<button type="button" role="menuitem" class="danger" on:click={resetTrip}>Reset</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="meta-row">
		<span class="date-range">{formatDateRange(trip.startDate, trip.endDate)}</span>
		{#if dayCount}
			<span class="meta-sep" aria-hidden="true">·</span>
			<span class="day-count">{dayCount} days</span>
		{/if}
	</div>

	{#if trip.destinations.length}
		<div class="dest-chips" aria-label="Destinations">
			{#each trip.destinations as d}
				<span class="chip">{d}</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.trip-header {
		margin-bottom: 1.25rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.375rem;
	}

	.trip-title {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 600;
		line-height: 1.1;
		color: var(--ink);
		margin: 0;
		flex: 1;
		min-width: 0;
		cursor: text;
		letter-spacing: -0.01em;
		overflow-wrap: break-word;
	}
	@media (min-width: 640px) {
		.trip-title { font-size: 2rem; }
	}

	.title-input {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--ink);
		background: transparent;
		border: none;
		border-bottom: 2px solid var(--accent);
		outline: none;
		flex: 1;
		min-width: 0;
		padding: 0;
	}
	@media (min-width: 640px) {
		.title-input { font-size: 2rem; }
	}

	.menu-wrap {
		position: relative;
		flex-shrink: 0;
	}
	.menu-btn {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-muted);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
	}
	.menu-btn:hover,
	.menu-btn[aria-expanded="true"] {
		background: var(--accent-muted);
		color: var(--ink);
		border-color: var(--accent);
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.375rem);
		right: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 10px 28px rgba(61, 43, 31, 0.15);
		display: flex;
		flex-direction: column;
		min-width: 10rem;
		z-index: 30;
		overflow: hidden;
	}
	.menu button {
		background: none;
		border: none;
		padding: 0.75rem 1rem;
		text-align: left;
		font-family: var(--font-body);
		font-size: 0.875rem;
		color: var(--ink);
		cursor: pointer;
		transition: background 150ms ease;
	}
	.menu button:hover { background: var(--accent-muted); }
	.menu button.danger { color: var(--danger); }
	.menu button.danger:hover { background: var(--accent-muted); }

	.meta-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.375rem 0.5rem;
		font-size: 0.8125rem;
		color: var(--ink-muted);
		font-variant-numeric: tabular-nums;
		margin-bottom: 0.625rem;
	}
	.meta-sep { color: var(--ink-faint); }
	.day-count { color: var(--ink-faint); }

	.dest-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.3125rem 0.75rem;
		font-family: var(--font-display);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
		background: var(--accent-muted);
		border-radius: 999px;
	}
</style>
