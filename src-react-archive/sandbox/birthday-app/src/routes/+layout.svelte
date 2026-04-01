<script lang="ts">
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import { fly } from 'svelte/transition';
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<svelte:head>
	<title>Birthday Chronicles</title>
</svelte:head>

<div class="min-h-dvh flex flex-col bg-slate-950">
	<main class="flex-1 pb-20">
		{#key $page.url.pathname}
			<div
				in:fly={{ y: 8, duration: 200, delay: 100 }}
				out:fly={{ y: -8, duration: 150 }}
			>
				{@render children()}
			</div>
		{/key}
	</main>
	<Nav />
</div>
