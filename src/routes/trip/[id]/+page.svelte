<script lang="ts">
	import { page } from '$app/stores';
	import { trips } from '$lib/stores/trips';
	import { journalStore } from '$lib/stores/journal';
	import { scriptsStore } from '$lib/stores/scripts';
	import { isAuthenticated } from '$lib/stores/auth';
	import { onMount, onDestroy } from 'svelte';
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
	import { dbGet } from '$lib/stores/db';
	import type { Booking } from '$lib/types/trip';

	$: tripId = $page.params.id as string;
	$: trip = $trips[tripId];

	let activeView: 'week' | 'day' = 'week';
	let currentDayIndex = 0;
	let userNavigated = false;
	let _lastKnownDaysCount = 0;

	// Only reset currentDayIndex when the trip gains more days (e.g. server data arrives with
	// more days than the IDB cache had). Content-only updates (PUT responses) must NOT reset
	// the user's current day position.
	$: if (trip && !userNavigated) {
		const len = trip.days?.length ?? 0;
		if (len > _lastKnownDaysCount) {
			_lastKnownDaysCount = len;
			currentDayIndex = todayDayIndex(trip);
		}
	}

	/** Compute the day index for today within the trip date range, clamped to valid bounds. */
	function todayDayIndex(t: typeof trip): number {
		if (!t?.startDate || !t?.days?.length) return 0;
		const start = new Date(t.startDate + 'T00:00:00');
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
		return Math.max(0, Math.min(diff, t.days.length - 1));
	}

	// Bookings are now served from the FastAPI backend (wabbazzar-ice),
	// not bundled into the repo. `null` = still loading, `[]` = no bookings.
	let bookings: Booking[] | null = null;
	let bookingsError: string | null = null;

	function onVisibilityChange() {
		if (document.visibilityState === 'visible' && tripId) {
			journalStore.refresh(tripId);
		}
	}

	onMount(async () => {
		await trips.init();
		journalStore.init(tripId);
		scriptsStore.init(tripId);
		initPhotoQueue();
		document.addEventListener('visibilitychange', onVisibilityChange);
		// Restore saved view preference before first render to avoid week->day flash
		const savedView = await dbGet<string>('prefs', `hw-trip-view-${tripId}`);
		if (savedView === 'week' || savedView === 'day') {
			activeView = savedView;
		}
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		}
	});

	$: if (tripId && $isAuthenticated) loadBookings(tripId);

	async function loadBookings(id: string) {
		bookingsError = null;
		try {
			bookings = await getBookings(id, (fresh) => {
				// Server returned newer data — update silently
				bookings = fresh;
			});
		} catch (e) {
			bookingsError = e instanceof Error ? e.message : 'Failed to load bookings';
			if (!bookings) bookings = [];
		}
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
		userNavigated = true;
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
			{#if $isAuthenticated}
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
					<span class="journal-card-day">Day {currentDayIndex + 1}</span>
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

	<div id="bookings-section" class="section-wrap mt-8 scroll-mt-4">
		{#if bookings === null}
			<div class="text-sm" style="color: var(--ink-faint)">Loading bookings…</div>
		{:else if bookings.length > 0}
			<BookingsSection {bookings} {tripId} />
		{/if}
	</div>

	<div id="todos-section" class="section-wrap mt-6 scroll-mt-4">
		<TodosSection {tripId} />
	</div>

	<button
		type="button"
		class="scroll-top-fab"
		on:click={scrollToTop}
		aria-label="Back to top"
		title="Back to top"
	>
		<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<path d="M6 15l6-6 6 6"/>
		</svg>
	</button>
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
	.journal-card-day {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.06em;
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

	.scroll-top-fab {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
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
	.scroll-top-fab:hover {
		background: var(--accent-hover);
		box-shadow: 0 6px 20px rgba(184, 110, 43, 0.45);
	}
	.scroll-top-fab:active {
		transform: scale(0.94);
	}
</style>
