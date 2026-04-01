<script lang="ts">
	import type { Trip } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';
	import { createEventDispatcher, onMount } from 'svelte';
	import DayCard from './DayCard.svelte';

	export let trip: Trip;
	export let tripId: string;

	const dispatch = createEventDispatcher();

	let todayStr = '';

	onMount(() => {
		todayStr = new Date().toISOString().split('T')[0];
	});

	// Group days by week (Mon-Sun)
	function getWeekGroups(days: typeof trip.days) {
		const groups: { label: string; days: { day: typeof days[0]; index: number }[] }[] = [];
		let currentWeek: typeof groups[0] | null = null;
		let currentWeekStart = '';

		for (let i = 0; i < days.length; i++) {
			const d = days[i];
			const date = new Date(d.date + 'T12:00:00');
			const dayOfWeek = date.getDay(); // 0=Sun
			// Get Monday of this week
			const monday = new Date(date);
			monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
			const weekKey = monday.toISOString().split('T')[0];

			if (weekKey !== currentWeekStart) {
				const sunday = new Date(monday);
				sunday.setDate(monday.getDate() + 6);
				const label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
				currentWeek = { label, days: [] };
				currentWeekStart = weekKey;
				groups.push(currentWeek);
			}

			currentWeek!.days.push({ day: d, index: i });
		}

		return groups;
	}

	$: weekGroups = getWeekGroups(trip.days);

	function handleDaySelect(e: CustomEvent<number>) {
		dispatch('selectDay', e.detail);
	}
</script>

<div class="space-y-6">
	{#each weekGroups as group}
		<div>
			<p class="section-label mb-3">{group.label}</p>
			<div class="space-y-2">
				{#each group.days as { day, index }}
					<DayCard
						{day}
						dayIndex={index}
						{tripId}
						isToday={day.date === todayStr}
						on:select={handleDaySelect}
					/>
				{/each}
			</div>
		</div>
	{/each}

	<button
		on:click={() => trips.addDay(tripId)}
		class="w-full py-3 text-sm rounded-lg"
		style="border: 1px dashed var(--border-strong); color: var(--ink-muted); background: none; cursor: pointer; font-family: var(--font-body)"
	>
		+ Add day
	</button>
</div>
