<script lang="ts">
	import { trip } from '$lib/stores/trip';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let activeDay = $state(0);
	let day = $derived($trip.days[activeDay]);
	onMount(() => { mounted = true; });
</script>

<div class="px-4 pt-12 pb-8 max-w-lg mx-auto">
	{#if mounted}
		<div in:fly={{ y: 20, duration: 400 }}>
			<h1 class="text-2xl font-bold text-white mb-1">Itinerary</h1>
			<p class="text-sm text-slate-400 mb-6">{$trip.dates}</p>
		</div>

		<!-- Day tabs -->
		<div in:fly={{ y: 20, duration: 400, delay: 80 }} class="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
			{#each $trip.days as day, i}
				<button
					onclick={() => activeDay = i}
					class="shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border
						{activeDay === i
							? day.highlight
								? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
								: 'bg-slate-800 text-white border-slate-700'
							: 'bg-slate-900/40 text-slate-500 border-slate-800/40 hover:text-slate-300'}"
				>
					<span class="block">{day.label}</span>
					{#if day.highlight}
						<span class="block text-[10px] mt-0.5 opacity-80">{day.highlight}</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Activities -->
		{#key activeDay}
			<div class="space-y-3" in:fly={{ x: 20, duration: 250 }}>
				{#if day.highlight}
					<div class="rounded-xl bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/20 px-4 py-3 mb-4">
						<p class="text-sm font-semibold text-amber-400">🎂 {day.highlight}</p>
					</div>
				{/if}

				{#each day.activities as activity, i}
					<div
						in:fly={{ y: 12, duration: 300, delay: i * 60 }}
						class="rounded-xl bg-slate-900/40 border border-slate-800/40 p-4"
					>
						<div class="flex items-start gap-3">
							<span class="text-xl mt-0.5">{activity.icon}</span>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between gap-2">
									<p class="text-sm font-medium text-slate-200">{activity.title}</p>
									<span class="text-xs text-slate-500 shrink-0">{activity.time}</span>
								</div>
								<p class="text-xs text-slate-400 mt-1">{activity.description}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/key}
	{/if}
</div>

<style>
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
