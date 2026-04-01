<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="app">
	{@render children()}
</div>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family: 'Crimson Text', Georgia, serif;
		background: #0a0a0a;
		color: #fafafa;
		min-height: 100vh;
		overflow-x: hidden;
	}

	:global(.font-display) {
		font-family: 'Cinzel', serif;
	}

	:global(html) {
		scroll-behavior: smooth;
	}

	:global(::-webkit-scrollbar) {
		width: 8px;
	}

	:global(::-webkit-scrollbar-track) {
		background: #1a1a1a;
	}

	:global(::-webkit-scrollbar-thumb) {
		background: #444;
		border-radius: 4px;
	}

	.app {
		min-height: 100vh;
	}
</style>
