<script lang="ts">
	import { trips as tripsStore } from '$lib/stores/trips';
	import type { Trip } from '$lib/types/trip';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import NewTripModal from '$lib/components/trip/NewTripModal.svelte';

	onMount(() => { tripsStore.init(); });

	$: allTrips = Object.values($tripsStore) as Trip[];

	let newTripOpen = false;
	let deletingId: string | null = null;

	function openNewTrip() {
		newTripOpen = true;
	}

	function handleCreated(e: CustomEvent<{ id: string }>) {
		newTripOpen = false;
		goto(`/trip/${e.detail.id}`);
	}

	async function handleRemoveTrip(tripId: string, tripName: string) {
		if (!confirm(`Remove "${tripName}"? This deletes the trip and all its bookings, todos, and chat history.`)) return;
		deletingId = tripId;
		await tripsStore.removeTrip(tripId);
		deletingId = null;
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
</script>

<svelte:head>
	<title>Trips - H&W Travel</title>
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
	{#each allTrips as trip}
		{@const countdown = daysUntil(trip.startDate)}
		{@const daysLeft = daysUntil(trip.endDate)}
		{@const dayNumber = Math.abs(countdown) + 1}
		<div class="trip-card-wrap" class:trip-card-deleting={deletingId === trip.id}>
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
							<span class="badge badge-active">Today!</span>
						{:else if daysLeft >= 0}
							<span class="font-display text-2xl font-semibold" style="color: var(--accent)">
								{dayNumber}
							</span>
							<span class="block section-label">day {dayNumber} of {tripDuration(trip)}</span>
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
			<button
				type="button"
				class="remove-trip-btn"
				aria-label="Remove {trip.name}"
				title="Remove trip"
				disabled={deletingId === trip.id}
				on:click|stopPropagation={() => handleRemoveTrip(trip.id, trip.name)}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
				</svg>
			</button>
		</div>
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

	.trip-card-wrap {
		position: relative;
		transition: opacity 300ms ease;
	}

	.trip-card-deleting {
		opacity: 0.4;
		pointer-events: none;
	}

	.remove-trip-btn {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 32px;
		height: 32px;
		border-radius: var(--radius);
		border: 1px solid transparent;
		background: transparent;
		color: var(--ink-faint);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 150ms ease, color 150ms ease, background-color 150ms ease, border-color 150ms ease;
		z-index: 2;
	}

	.trip-card-wrap:hover .remove-trip-btn,
	.remove-trip-btn:focus-visible {
		opacity: 1;
	}

	.remove-trip-btn:hover {
		color: var(--danger, #c0392b);
		background: rgba(192, 57, 43, 0.08);
		border-color: rgba(192, 57, 43, 0.2);
	}

	.remove-trip-btn:active {
		transform: scale(0.92);
	}
</style>
