<script lang="ts">
	import { chinaTrip } from '$lib/data/china-2026';
	import type { Trip } from '$lib/types/trip';

	const trips: Trip[] = [chinaTrip];

	function daysUntil(dateStr: string): number {
		const target = new Date(dateStr + 'T00:00:00');
		const now = new Date();
		return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
	}
</script>

<svelte:head>
	<title>Trips - H&W Travel</title>
</svelte:head>

<p class="section-label mb-6">Upcoming Trips</p>

<div class="grid gap-4 max-w-2xl">
	{#each trips as trip}
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
						<span class="block section-label">days</span>
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
					{trip.days.length} days
				</span>
				<span class="badge" style="background: var(--accent-muted); color: var(--accent)">
					{trip.destinations.length} cities
				</span>
			</div>
		</a>
	{/each}
</div>
