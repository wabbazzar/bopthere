<script lang="ts">
	import { page } from '$app/stores';
	import { trips } from '$lib/stores/trips';
	import { onMount } from 'svelte';
	import TripHeader from '$lib/components/trip/TripHeader.svelte';
	import ViewToggle from '$lib/components/trip/ViewToggle.svelte';
	import WeekView from '$lib/components/trip/WeekView.svelte';
	import DayView from '$lib/components/trip/DayView.svelte';
	import BookingsSection from '$lib/components/trip/BookingsSection.svelte';
	import TodosSection from '$lib/components/trip/TodosSection.svelte';

	$: tripId = $page.params.id as string;
	$: trip = $trips[tripId];

	let activeView: 'week' | 'day' = 'week';
	let currentDayIndex = 0;

	const DAY_KEY_PREFIX = 'hw-trip-day-';

	onMount(() => {
		trips.init();
		const saved = localStorage.getItem(DAY_KEY_PREFIX + tripId);
		if (saved !== null) {
			const idx = parseInt(saved, 10);
			const maxIdx = (trip?.days?.length ?? 1) - 1;
			if (!isNaN(idx) && idx >= 0) currentDayIndex = Math.min(idx, maxIdx);
		}
	});

	$: if (tripId && typeof localStorage !== 'undefined') {
		localStorage.setItem(DAY_KEY_PREFIX + tripId, String(currentDayIndex));
	}

	function handleSelectDay(e: CustomEvent<number>) {
		currentDayIndex = e.detail;
		activeView = 'day';
	}

	function scrollToSection(id: string) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{trip?.name || 'Trip'} - H&W Travel</title>
</svelte:head>

{#if trip}
	<TripHeader {trip} {tripId} />

	<div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
		<div class="flex items-center gap-2">
			<ViewToggle bind:activeView {tripId} />
			<div class="jump-nav" role="group" aria-label="Jump to section">
				{#if trip.bookings?.length}
					<button
						type="button"
						class="jump-btn"
						on:click={() => scrollToSection('bookings-section')}
						aria-label="Jump to bookings"
					>
						Bookings
					</button>
				{/if}
				<button
					type="button"
					class="jump-btn"
					on:click={() => scrollToSection('todos-section')}
					aria-label="Jump to todos"
				>
					Todos
				</button>
			</div>
		</div>
		{#if activeView === 'week'}
			<span class="text-xs" style="color: var(--ink-faint)">{trip.days.length} days</span>
		{/if}
	</div>

	{#if activeView === 'week'}
		<WeekView {trip} {tripId} on:selectDay={handleSelectDay} />
	{:else}
		<DayView {trip} {tripId} bind:currentDayIndex />
	{/if}

	{#if trip.bookings?.length}
		<div id="bookings-section" class="mt-8 scroll-mt-4">
			<BookingsSection bookings={trip.bookings} />
		</div>
	{/if}

	<div id="todos-section" class="mt-6 scroll-mt-4">
		<TodosSection {tripId} />
	</div>
{:else}
	<p>Trip not found.</p>
{/if}

<style>
	.jump-nav {
		display: inline-flex;
		gap: 0.25rem;
	}
	.jump-btn {
		padding: 0.5rem 0.875rem;
		font-family: var(--font-display);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.jump-btn:hover {
		background: var(--accent-muted);
		color: var(--ink);
	}
	.scroll-mt-4 {
		scroll-margin-top: 1rem;
	}
</style>
