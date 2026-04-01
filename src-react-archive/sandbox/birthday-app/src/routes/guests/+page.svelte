<script lang="ts">
	import { trip } from '$lib/stores/trip';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	onMount(() => { mounted = true; });

	const statusColors: Record<string, string> = {
		confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
		pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
		declined: 'bg-slate-500/15 text-slate-400 border-slate-500/20'
	};
</script>

<div class="px-4 pt-12 pb-8 max-w-lg mx-auto">
	{#if mounted}
		<div in:fly={{ y: 20, duration: 400 }}>
			<h1 class="text-2xl font-bold text-white mb-1">Guests</h1>
			<p class="text-sm text-slate-400 mb-6">{$trip.guests.length} invited &middot; {$trip.guests.filter(g => g.status === 'confirmed').length} confirmed</p>
		</div>

		<!-- Status filters -->
		<div in:fly={{ y: 20, duration: 400, delay: 80 }} class="flex gap-2 mb-6">
			{#each ['all', 'confirmed', 'pending', 'declined'] as filter}
				<button class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
					{filter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-900/40 text-slate-500 hover:text-slate-300'}">
					{filter.charAt(0).toUpperCase() + filter.slice(1)}
				</button>
			{/each}
		</div>

		<!-- Guest list -->
		<div class="space-y-2">
			{#each $trip.guests as guest, i}
				<div
					in:fly={{ y: 12, duration: 300, delay: 120 + i * 50 }}
					class="flex items-center justify-between rounded-xl bg-slate-900/40 border border-slate-800/40 p-4 hover:bg-slate-900/60 transition-colors"
				>
					<div class="flex items-center gap-3">
						<span class="text-xl w-8 text-center">{guest.emoji}</span>
						<span class="text-sm font-medium text-slate-200">{guest.name}</span>
					</div>
					<span class="text-xs font-medium px-2.5 py-1 rounded-full border {statusColors[guest.status]}">
						{guest.status}
					</span>
				</div>
			{/each}
		</div>

		<!-- Add guest -->
		<div in:fly={{ y: 20, duration: 400, delay: 500 }} class="mt-6">
			<button class="w-full rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors">
				+ Add Guest
			</button>
		</div>
	{/if}
</div>
