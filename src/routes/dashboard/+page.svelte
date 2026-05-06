<script lang="ts">
	import { trips as tripsStore } from '$lib/stores/trips';
	import type { Trip } from '$lib/types/trip';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import NewTripModal from '$lib/components/trip/NewTripModal.svelte';

	onMount(() => { tripsStore.init(); });

	$: allTrips = Object.values($tripsStore) as Trip[];

	$: activeTrips = allTrips.filter((t) => {
		if (!t.endDate) return true;
		return daysUntil(t.endDate) >= 0;
	});

	$: pastTrips = allTrips.filter((t) => {
		if (!t.endDate) return false;
		return daysUntil(t.endDate) < 0;
	});

	let newTripOpen = false;
	function openNewTrip() {
		newTripOpen = true;
	}

	function handleCreated(e: CustomEvent<{ id: string }>) {
		newTripOpen = false;
		goto(`/trip/${e.detail.id}`);
	}

	function daysUntil(dateStr: string): number {
		const target = new Date(dateStr + 'T00:00:00');
		const now = new Date();
		return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
	}

	function tripDuration(trip: Trip): number {
		if (!trip.startDate || !trip.endDate) return trip.days.length;
		const start = new Date(trip.startDate + 'T00:00:00');
		const end = new Date(trip.endDate + 'T00:00:00');
		return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	}

	function formatDateRange(trip: Trip): string {
		if (!trip.startDate) return '';
		const start = new Date(trip.startDate + 'T00:00:00');
		const end = trip.endDate ? new Date(trip.endDate + 'T00:00:00') : null;
		const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		return end ? `${fmt(start)} \u2013 ${fmt(end)}` : fmt(start);
	}
</script>

<svelte:head>
	<title>Trips - BopThere</title>
</svelte:head>

<div class="flex items-center justify-between mb-6 max-w-2xl">
	<p class="section-label m-0">Upcoming Trips</p>
	<button
		type="button"
		class="new-trip-btn"
		aria-label="Create a new trip"
		on:click={openNewTrip}
	>
		+ New trip
	</button>
</div>

<NewTripModal
	open={newTripOpen}
	on:created={handleCreated}
	on:close={() => (newTripOpen = false)}
/>

<div class="grid gap-4 max-w-2xl">
	{#each activeTrips as trip}
		{@const countdown = daysUntil(trip.startDate)}
		{@const daysLeft = daysUntil(trip.endDate)}
		{@const dayNumber = Math.abs(countdown) + 1}
		<a href="/trip/{trip.id}" class="card block p-5 no-underline group">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="font-display text-xl font-semibold" style="color: var(--ink)">
						{trip.name}
					</h2>
					<p class="text-sm mt-1" style="color: var(--ink-muted)">
						{formatDateRange(trip)}
					</p>
					<p class="text-sm mt-1" style="color: var(--ink-faint)">
						{trip.destinations.join(' \u00B7 ')}
					</p>
				</div>
				<div class="text-right shrink-0 ml-4">
					{#if countdown > 0}
						<span class="font-display text-2xl font-semibold" style="color: var(--accent)">
							{countdown}
						</span>
						<span class="block section-label">days away</span>
					{:else if countdown === 0}
						<span class="badge badge-active">Today!</span>
					{:else if daysLeft >= 0}
						<span class="font-display text-2xl font-semibold" style="color: var(--accent)">
							{dayNumber}
						</span>
						<span class="block section-label">day {dayNumber} of {tripDuration(trip)}</span>
					{/if}
				</div>
			</div>
			<div class="mt-3 flex gap-2">
				<span class="badge" style="background: var(--accent-muted); color: var(--accent)">
					{tripDuration(trip)} days
				</span>
				<span class="badge" style="background: var(--accent-muted); color: var(--accent)">
					{trip.destinations.length} cities
				</span>
			</div>
		</a>
	{:else}
		<p class="text-sm" style="color: var(--ink-faint)">No upcoming trips. Plan your next adventure!</p>
	{/each}
</div>

{#if pastTrips.length > 0 || true}
<p class="section-label mb-4 mt-10">Past Trips</p>

<div class="grid gap-4 max-w-2xl">
	{#each pastTrips as trip}
		<a href="/trip/{trip.id}" class="card block p-5 no-underline group past-card">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="font-display text-xl font-semibold" style="color: var(--ink)">
						{trip.name}
					</h2>
					<p class="text-sm mt-1" style="color: var(--ink-muted)">
						{formatDateRange(trip)}
					</p>
					<p class="text-sm mt-1" style="color: var(--ink-faint)">
						{trip.destinations.join(' \u00B7 ')}
					</p>
				</div>
				<div class="text-right shrink-0 ml-4">
					<span class="badge" style="color: var(--ink-faint); background: var(--accent-muted)">
						Completed
					</span>
				</div>
			</div>
			<div class="mt-3 flex gap-2">
				<span class="badge" style="background: var(--accent-muted); color: var(--accent)">
					{tripDuration(trip)} days
				</span>
				<span class="badge" style="background: var(--accent-muted); color: var(--accent)">
					{trip.destinations.length} cities
				</span>
			</div>
		</a>
	{/each}

	<a
		href="/archive/"
		rel="external"
		data-sveltekit-reload
		aria-label="Open wedding archive"
		class="card block p-5 no-underline group past-card"
	>
		<div class="flex items-start justify-between">
			<div>
				<h2 class="font-display text-xl font-semibold" style="color: var(--ink)">
					Wedding Archive
				</h2>
				<p class="text-sm mt-1" style="color: var(--ink-muted)">
					December 2025 {'\u00B7'} Maui, Hawaii
				</p>
				<p class="text-sm mt-1" style="color: var(--ink-faint)">
					RSVPs, photos, bingo, leaderboard
				</p>
			</div>
			<div class="text-right shrink-0 ml-4">
				<span class="badge" style="color: var(--ink-faint); background: var(--accent-muted)">
					Archive
				</span>
			</div>
		</div>
	</a>
</div>
{/if}

<style>
	.new-trip-btn {
		font-family: var(--font-body);
		font-size: 0.8rem;
		padding: 0.4rem 0.85rem;
		border-radius: var(--radius);
		border: 1px solid var(--accent);
		background: transparent;
		color: var(--accent);
		cursor: pointer;
		transition: background-color 150ms ease, color 150ms ease;
	}

	.new-trip-btn:hover {
		background: var(--accent);
		color: var(--surface);
	}

	.badge-active {
		background: var(--accent);
		color: var(--surface);
		font-weight: 600;
	}

	.past-card {
		opacity: 0.75;
	}
	.past-card:hover {
		opacity: 1;
	}
</style>
