<script lang="ts">
	import { page } from '$app/stores';
	import { trips } from '$lib/stores/trips';
	import { journalStore } from '$lib/stores/journal';
	import { isAuthenticated } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import type { JournalEntry } from '$lib/types/trip';
	import TripHeader from '$lib/components/trip/TripHeader.svelte';
	import ViewToggle from '$lib/components/trip/ViewToggle.svelte';
	import WeekView from '$lib/components/trip/WeekView.svelte';
	import DayView from '$lib/components/trip/DayView.svelte';
	import BookingsSection from '$lib/components/trip/BookingsSection.svelte';
	import TodosSection from '$lib/components/trip/TodosSection.svelte';
	import JournalHeader from '$lib/components/journal/JournalHeader.svelte';
	import ItineraryChecklist from '$lib/components/journal/ItineraryChecklist.svelte';
	import JournalBlocks from '$lib/components/journal/JournalBlocks.svelte';
	import { getBookings } from '$lib/services/bookings';
	import { initPhotoQueue } from '$lib/services/photo-queue';
	import { dbGet, dbPut } from '$lib/stores/db';
	import type { Booking } from '$lib/types/trip';

	$: tripId = $page.params.id as string;
	$: trip = $trips[tripId];

	let activeView: 'week' | 'day' = 'week';
	let currentDayIndex = 0;

	// Bookings are now served from the FastAPI backend (wabbazzar-ice),
	// not bundled into the repo. `null` = still loading, `[]` = no bookings.
	let bookings: Booking[] | null = null;
	let bookingsError: string | null = null;

	onMount(async () => {
		trips.init();
		journalStore.init(tripId);
		initPhotoQueue();
		const saved = await dbGet<string>('prefs', `hw-trip-day-${tripId}`);
		if (saved !== undefined) {
			const idx = parseInt(saved, 10);
			const maxIdx = (trip?.days?.length ?? 1) - 1;
			if (!isNaN(idx) && idx >= 0) currentDayIndex = Math.min(idx, maxIdx);
		}
	});

	$: if (tripId && $isAuthenticated) loadBookings(tripId);

	async function loadBookings(id: string) {
		bookings = null;
		bookingsError = null;
		try {
			bookings = await getBookings(id);
		} catch (e) {
			bookingsError = e instanceof Error ? e.message : 'Failed to load bookings';
			bookings = [];
		}
	}

	$: if (tripId) {
		dbPut('prefs', `hw-trip-day-${tripId}`, String(currentDayIndex));
	}

	// Journal entry for the current day
	$: currentDay = trip?.days?.[currentDayIndex];
	$: journalEntry = activeView === 'day' && currentDay
		? journalStore.createOrHydrate(tripId, currentDayIndex, currentDay)
		: undefined;
	// Re-read from store when it updates (same pattern as JournalDrawer)
	$: if (activeView === 'day') {
		const storeEntries = $journalStore[tripId] ?? [];
		const found = storeEntries.find((e: JournalEntry) => e.dayIndex === currentDayIndex);
		if (found) journalEntry = found;
	}

	function handleSelectDay(e: CustomEvent<number>) {
		currentDayIndex = e.detail;
		activeView = 'day';
	}

	function scrollToSection(id: string) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>{trip?.name || 'Trip'} - H&W Travel</title>
</svelte:head>

{#if trip}
	<TripHeader {trip} {tripId} />

	<div class="view-row">
		<ViewToggle bind:activeView {tripId} />
		<div class="jump-nav" role="group" aria-label="Jump to section">
			{#if activeView === 'day'}
				<button
					type="button"
					class="jump-link"
					on:click={() => scrollToSection('journal-section')}
					aria-label="Jump to journal"
				>
					Journal
				</button>
				<span class="jump-sep" aria-hidden="true">·</span>
			{/if}
			{#if bookings && bookings.length > 0}
				<button
					type="button"
					class="jump-link"
					on:click={() => scrollToSection('bookings-section')}
					aria-label="Jump to bookings"
				>
					Bookings
				</button>
				<span class="jump-sep" aria-hidden="true">·</span>
			{/if}
			<button
				type="button"
				class="jump-link"
				on:click={() => scrollToSection('todos-section')}
				aria-label="Jump to todos"
			>
				Todos
			</button>
		</div>
	</div>

	{#if activeView === 'week'}
		<WeekView {trip} {tripId} on:selectDay={handleSelectDay} />
	{:else}
		<DayView {trip} {tripId} bind:currentDayIndex />
	{/if}

	{#if activeView === 'day' && journalEntry}
		<div id="journal-section" class="section-wrap mt-6 scroll-mt-4">
			<div class="card journal-card">
				<div class="journal-card-header">
					<h2 class="journal-card-title">Journal</h2>
					<div class="journal-card-header-right">
						<span class="journal-card-day">Day {currentDayIndex + 1}</span>
						<button
							type="button"
							class="back-to-top-inline"
							on:click={scrollToTop}
							aria-label="Back to top"
							title="Back to top"
						>
							<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
								<path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</button>
					</div>
				</div>
				<div class="journal-card-body">
					<JournalHeader
						{tripId}
						dayIndex={currentDayIndex}
						mood={journalEntry.mood}
						weather={journalEntry.weather}
					/>
					<ItineraryChecklist
						{tripId}
						dayIndex={currentDayIndex}
						itinerary={journalEntry.itinerary}
					/>
					<JournalBlocks
						{tripId}
						dayIndex={currentDayIndex}
						blocks={journalEntry.blocks}
					/>
				</div>
			</div>
		</div>
	{/if}

	{#if bookings === null}
		<div class="mt-8 text-sm" style="color: var(--ink-faint)">Loading bookings…</div>
	{:else if bookings.length > 0}
		<div id="bookings-section" class="section-wrap mt-8 scroll-mt-4">
			<BookingsSection {bookings} {tripId} />
			<button
				type="button"
				class="back-to-top"
				on:click={scrollToTop}
				aria-label="Back to top"
				title="Back to top"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path
						d="M6 15l6-6 6 6"
						fill="none"
						stroke="currentColor"
						stroke-width="2.25"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	{/if}

	<div id="todos-section" class="section-wrap mt-6 scroll-mt-4">
		<TodosSection {tripId} />
		<button
			type="button"
			class="back-to-top"
			on:click={scrollToTop}
			aria-label="Back to top"
			title="Back to top"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<path
					d="M6 15l6-6 6 6"
					fill="none"
					stroke="currentColor"
					stroke-width="2.25"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
	</div>
{:else}
	<p>Trip not found.</p>
{/if}

<style>
	.view-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.jump-nav {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
	}
	.jump-link {
		padding: 0.5rem 0.5rem;
		font-family: var(--font-display);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		background: transparent;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.jump-link:hover {
		color: var(--ink);
		background: var(--accent-muted);
	}
	.jump-sep {
		color: var(--ink-faint);
		font-size: 0.65rem;
		margin: 0 0.125rem;
	}
	.scroll-mt-4 {
		scroll-margin-top: 1rem;
	}

	.journal-card {
		overflow: visible;
	}
	.journal-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
	}
	.journal-card-title {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink);
		margin: 0;
	}
	.journal-card-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.journal-card-day {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.back-to-top-inline {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink-faint);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
		padding: 0;
		flex-shrink: 0;
	}
	.back-to-top-inline:hover {
		color: var(--ink);
		background: var(--accent-muted);
		border-color: var(--accent);
	}
	.journal-card-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.section-wrap {
		position: relative;
	}
	.back-to-top {
		position: absolute;
		/* sit inside the card's p-5 padding so the button lives within
		   the box frame and the bob animation can't clip the border */
		top: 0.875rem;
		right: 0.875rem;
		width: 30px;
		height: 30px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink-faint);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 2;
		transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
		animation: bob 2.6s ease-in-out infinite;
	}
	.back-to-top:hover {
		color: var(--ink);
		background: var(--accent-muted);
		border-color: var(--accent);
		animation-play-state: paused;
	}
	.back-to-top:active {
		transform: translateY(0) scale(0.94);
	}
	@keyframes bob {
		0%, 100% { transform: translateY(0); }
		50%      { transform: translateY(-3px); }
	}
	@media (prefers-reduced-motion: reduce) {
		.back-to-top { animation: none; }
	}
</style>
