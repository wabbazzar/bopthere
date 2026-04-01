<script lang="ts">
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	onMount(() => { mounted = true; });

	const games = [
		{
			title: 'Family Feud',
			description: 'Birthday edition - survey says...',
			icon: '📊',
			status: 'ready' as const
		},
		{
			title: 'Trivia Night',
			description: 'How well do you know the birthday duo?',
			icon: '🧠',
			status: 'coming-soon' as const
		},
		{
			title: 'Photo Challenge',
			description: 'Scavenger hunt with photos',
			icon: '📸',
			status: 'coming-soon' as const
		},
		{
			title: 'Karaoke Battle',
			description: 'Song voting and scoring',
			icon: '🎤',
			status: 'coming-soon' as const
		}
	];
</script>

<div class="px-4 pt-12 pb-8 max-w-lg mx-auto">
	{#if mounted}
		<div in:fly={{ y: 20, duration: 400 }}>
			<h1 class="text-2xl font-bold text-white mb-1">Games</h1>
			<p class="text-sm text-slate-400 mb-6">Trip activities and competitions</p>
		</div>

		<div class="space-y-3">
			{#each games as game, i}
				<button
					in:fly={{ y: 12, duration: 300, delay: 80 + i * 60 }}
					class="w-full text-left rounded-xl border p-5 transition-all duration-200
						{game.status === 'ready'
							? 'bg-slate-900/60 border-slate-700 hover:bg-slate-900/80 hover:border-slate-600 cursor-pointer'
							: 'bg-slate-900/20 border-slate-800/30 cursor-default'}"
				>
					<div class="flex items-start gap-4">
						<span class="text-2xl">{game.icon}</span>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<p class="text-sm font-semibold {game.status === 'ready' ? 'text-white' : 'text-slate-500'}">
									{game.title}
								</p>
								{#if game.status === 'coming-soon'}
									<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
										Soon
									</span>
								{/if}
							</div>
							<p class="text-xs {game.status === 'ready' ? 'text-slate-400' : 'text-slate-600'} mt-1">
								{game.description}
							</p>
						</div>
						{#if game.status === 'ready'}
							<svg class="h-4 w-4 text-slate-600 mt-1" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
							</svg>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
