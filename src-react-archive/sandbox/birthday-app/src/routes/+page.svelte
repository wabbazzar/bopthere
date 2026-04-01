<script lang="ts">
	import { trip, confirmedGuests, pendingGuests, countdown, totalDays } from '$lib/stores/trip';
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	onMount(() => { mounted = true; });
</script>

<div class="px-4 pt-12 pb-8 max-w-lg mx-auto">
	<!-- Hero -->
	{#if mounted}
		<div in:fly={{ y: 20, duration: 400, delay: 0 }} class="mb-8">
			<p class="text-sm font-medium text-amber-400/80 tracking-widest uppercase mb-2">September 2026</p>
			<h1 class="text-4xl font-bold tracking-tight text-white mb-1">{$trip.title}</h1>
			<p class="text-slate-400 text-lg">{$trip.destination} &middot; {$trip.dates}</p>
		</div>

		<!-- Countdown -->
		<div in:fly={{ y: 20, duration: 400, delay: 80 }} class="mb-8">
			<div class="rounded-2xl bg-gradient-to-br {$trip.coverGradient} border border-slate-800/50 p-6">
				<div class="flex items-baseline gap-3">
					<span class="text-5xl font-bold tabular-nums text-white">{$countdown}</span>
					<span class="text-slate-400 text-sm font-medium">days away</span>
				</div>
			</div>
		</div>

		<!-- Stats row -->
		<div in:fly={{ y: 20, duration: 400, delay: 160 }} class="grid grid-cols-3 gap-3 mb-8">
			<div class="rounded-xl bg-slate-900/60 border border-slate-800/40 p-4 text-center">
				<p class="text-2xl font-semibold text-emerald-400">{$confirmedGuests.length}</p>
				<p class="text-xs text-slate-500 mt-0.5">Confirmed</p>
			</div>
			<div class="rounded-xl bg-slate-900/60 border border-slate-800/40 p-4 text-center">
				<p class="text-2xl font-semibold text-amber-400">{$pendingGuests.length}</p>
				<p class="text-xs text-slate-500 mt-0.5">Pending</p>
			</div>
			<div class="rounded-xl bg-slate-900/60 border border-slate-800/40 p-4 text-center">
				<p class="text-2xl font-semibold text-sky-400">{$totalDays}</p>
				<p class="text-xs text-slate-500 mt-0.5">Days</p>
			</div>
		</div>

		<!-- Quick links -->
		<div in:fly={{ y: 20, duration: 400, delay: 240 }} class="space-y-3">
			<a href="/guests" class="flex items-center justify-between rounded-xl bg-slate-900/40 border border-slate-800/40 p-4 group hover:bg-slate-900/60 transition-colors">
				<div class="flex items-center gap-3">
					<span class="text-xl">👥</span>
					<div>
						<p class="text-sm font-medium text-slate-200">Guest List</p>
						<p class="text-xs text-slate-500">{$trip.guests.length} invited</p>
					</div>
				</div>
				<svg class="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
				</svg>
			</a>
			<a href="/itinerary" class="flex items-center justify-between rounded-xl bg-slate-900/40 border border-slate-800/40 p-4 group hover:bg-slate-900/60 transition-colors">
				<div class="flex items-center gap-3">
					<span class="text-xl">📅</span>
					<div>
						<p class="text-sm font-medium text-slate-200">Itinerary</p>
						<p class="text-xs text-slate-500">{$totalDays} days planned</p>
					</div>
				</div>
				<svg class="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
				</svg>
			</a>
			<a href="/games" class="flex items-center justify-between rounded-xl bg-slate-900/40 border border-slate-800/40 p-4 group hover:bg-slate-900/60 transition-colors">
				<div class="flex items-center gap-3">
					<span class="text-xl">🎮</span>
					<div>
						<p class="text-sm font-medium text-slate-200">Games</p>
						<p class="text-xs text-slate-500">Trip activities</p>
					</div>
				</div>
				<svg class="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
				</svg>
			</a>
		</div>

		<!-- Birthday badges -->
		<div in:fly={{ y: 20, duration: 400, delay: 320 }} class="mt-8 flex gap-3">
			<div class="flex-1 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-4">
				<p class="text-xs text-amber-400/70 font-medium mb-1">Sept 7</p>
				<p class="text-sm font-semibold text-white">Wesley's Birthday</p>
			</div>
			<div class="flex-1 rounded-xl bg-gradient-to-br from-rose-500/10 to-rose-500/5 border border-rose-500/20 p-4">
				<p class="text-xs text-rose-400/70 font-medium mb-1">Sept 8</p>
				<p class="text-sm font-semibold text-white">Heather's Birthday</p>
			</div>
		</div>
	{/if}
</div>
