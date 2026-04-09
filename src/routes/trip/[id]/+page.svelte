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
</script>

<svelte:head>
	<title>{trip?.name || 'Trip'} - H&W Travel</title>
</svelte:head>

{#if trip}
	<TripHeader {trip} {tripId} />

	<div class="flex items-center justify-between mb-6">
		<ViewToggle bind:activeView {tripId} />
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
		<div class="mt-8">
			<BookingsSection bookings={trip.bookings} />
		</div>
	{/if}

	<div class="mt-6">
		<TodosSection {tripId} />
	</div>
{:else}
	<p>Trip not found.</p>
{/if}
