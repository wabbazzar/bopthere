<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { scriptsStore } from '$lib/stores/scripts';
	import { trips } from '$lib/stores/trips';
	import { onMount } from 'svelte';

	$: tripId = $page.params.id as string;
	$: scriptId = $page.params.scriptId as string;
	$: allScripts = $scriptsStore[tripId] ?? [];
	$: script = allScripts.find((s: import('$lib/types/script').TourScript) => s.id === scriptId);
	$: trip = $trips[tripId];
	$: dayLocation = trip?.days?.[script?.dayIndex ?? 0]?.location ?? '';

	let copied = false;
	let copyTimeout: ReturnType<typeof setTimeout>;

	onMount(() => {
		if (tripId) {
			trips.init();
			scriptsStore.init(tripId);
		}
	});

	function renderMarkdown(text: string): string {
		let html = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// Headings
		html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
		html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
		html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

		// Inline formatting
		html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
		html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

		// Lists
		html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
		html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

		// Paragraphs
		html = html.replace(/\n\n/g, '</p><p>');
		html = html.replace(/\n/g, '<br>');
		html = `<p>${html}</p>`;
		html = html.replace(/<p><h([123])>/g, '<h$1>');
		html = html.replace(/<\/h([123])><\/p>/g, '</h$1>');
		html = html.replace(/<p><ul>/g, '<ul>');
		html = html.replace(/<\/ul><\/p>/g, '</ul>');
		html = html.replace(/<\/li><br><li>/g, '</li><li>');
		html = html.replace(/<p><\/p>/g, '');

		return html;
	}

	function stripMarkdown(text: string): string {
		return text
			.replace(/^#{1,6}\s+/gm, '')
			.replace(/\*\*(.*?)\*\*/g, '$1')
			.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			.replace(/`([^`]+)`/g, '$1');
	}

	async function copyText() {
		if (!script) return;
		const plain = stripMarkdown(script.content);
		await navigator.clipboard.writeText(plain);
		copied = true;
		clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => { copied = false; }, 2000);
	}

	async function copyAndOpenSpeechify() {
		if (!script) return;
		const plain = stripMarkdown(script.content);
		await navigator.clipboard.writeText(plain);
		copied = true;
		clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => { copied = false; }, 2000);
		window.open('https://app.speechify.com', '_blank');
	}

	async function deleteScript() {
		if (!script || !tripId || !confirm(`Delete "${script.title}"?`)) return;
		await scriptsStore.deleteScript(tripId, scriptId);
		goto(`/trip/${tripId}`);
	}
</script>

{#if script}
	<div class="script-page">
		<header class="script-header">
			<a href="/trip/{tripId}" class="back-link" aria-label="Back to trip">
				&larr; Back
			</a>
			<h1 class="script-title">{script.title}</h1>
			<div class="script-context">
				Day {script.dayIndex + 1}{dayLocation ? ` \u2014 ${dayLocation}` : ''}
			</div>
		</header>

		<article class="script-body">
			{@html renderMarkdown(script.content)}
		</article>

		<div class="script-actions">
			<button class="action-btn" on:click={copyText} aria-label="Copy script text">
				{copied ? 'Copied!' : 'Copy text'}
			</button>
			<button class="action-btn action-speechify" on:click={copyAndOpenSpeechify} aria-label="Copy and open Speechify">
				Copy & Open Speechify
			</button>
			<button class="action-btn action-delete" on:click={deleteScript} aria-label="Delete script">
				Delete
			</button>
		</div>
	</div>
{:else}
	<div class="script-page">
		<header class="script-header">
			<a href="/trip/{tripId}" class="back-link" aria-label="Back to trip">
				&larr; Back
			</a>
			<p class="not-found">Script not found.</p>
		</header>
	</div>
{/if}

<style>
	.script-page {
		max-width: 42rem;
		margin: 0 auto;
		padding: 1rem;
	}

	.script-header {
		margin-bottom: 1.5rem;
	}

	.back-link {
		display: inline-block;
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--accent);
		text-decoration: none;
		margin-bottom: 0.75rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.script-title {
		font-family: var(--font-display);
		font-size: 1.5rem;
		color: var(--ink);
		margin: 0 0 0.25rem;
		line-height: 1.3;
	}

	.script-context {
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--ink-faint);
	}

	.script-body {
		font-family: var(--font-body);
		font-size: 1rem;
		line-height: 1.75;
		color: var(--ink);
	}

	.script-body :global(h1) {
		font-family: var(--font-display);
		font-size: 1.35rem;
		margin: 1.5rem 0 0.75rem;
		color: var(--ink);
	}

	.script-body :global(h2) {
		font-family: var(--font-display);
		font-size: 1.15rem;
		margin: 1.25rem 0 0.5rem;
		color: var(--ink);
	}

	.script-body :global(h3) {
		font-family: var(--font-display);
		font-size: 1rem;
		margin: 1rem 0 0.4rem;
		color: var(--ink);
	}

	.script-body :global(p) {
		margin: 0 0 0.75rem;
	}

	.script-body :global(strong) {
		font-weight: 600;
	}

	.script-body :global(em) {
		font-style: italic;
	}

	.script-body :global(ul) {
		margin: 0.5rem 0;
		padding-left: 1.25em;
		list-style: disc;
	}

	.script-body :global(li) {
		margin-bottom: 0.25rem;
	}

	.script-body :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.script-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem 0;
		margin-top: 2rem;
		border-top: 1px solid var(--border);
		background: var(--surface);
	}

	.action-btn {
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		cursor: pointer;
		background: var(--surface-raised);
		color: var(--ink);
		transition: background 150ms ease;
		min-height: 44px;
	}

	.action-btn:hover {
		background: var(--surface-alt);
	}

	.action-speechify {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
	}

	.action-speechify:hover {
		opacity: 0.85;
	}

	.action-delete {
		margin-left: auto;
		color: var(--ink-faint);
		border-color: transparent;
		background: transparent;
	}

	.action-delete:hover {
		color: #c0392b;
		background: rgba(192, 57, 43, 0.08);
	}

	.not-found {
		font-family: var(--font-body);
		color: var(--ink-faint);
		margin-top: 1rem;
	}
</style>
