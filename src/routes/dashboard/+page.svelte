<script lang="ts">
	import { trips as tripsStore } from '$lib/stores/trips';
	import type { Trip } from '$lib/types/trip';
	import { onMount } from 'svelte';

	onMount(() => { tripsStore.init(); });

	$: allTrips = Object.values($tripsStore) as Trip[];

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
</script>

<svelte:head>
	<title>Trips - H&W Travel</title>
</svelte:head>

<p class="section-label mb-6">Upcoming Trips</p>

<div class="grid gap-4 max-w-2xl">
	{#each allTrips as trip}
		{@const countdown = daysUntil(trip.startDate)}
		<a href="/trip/{trip.id}" class="card block p-5 no-underline group">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="font-display text-xl font-semibold" style="color: var(--ink)">
						{trip.name}
					</h2>
					<p class="text-sm mt-1" style="color: var(--ink-muted)">
						{trip.startDate} {'\u2192'} {trip.endDate}
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
						<span class="badge badge-success">Today!</span>
					{:else}
						<span class="badge" style="color: var(--ink-faint); background: var(--accent-muted)">
							Completed
						</span>
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
	{/each}
</div>

<p class="section-label mb-4 mt-10">Past Trips</p>

<div class="grid gap-4 max-w-2xl">
	<a
		href="/archive/"
		rel="external"
		data-sveltekit-reload
		aria-label="Open wedding archive"
		class="card block p-5 no-underline group"
	>
		<div class="flex items-start justify-between">
			<div>
				<h2 class="font-display text-xl font-semibold" style="color: var(--ink)">
					Wedding Archive
				</h2>
				<p class="text-sm mt-1" style="color: var(--ink-muted)">
					2025-12 {'\u00B7'} Maui, Hawaii
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
