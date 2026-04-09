<script lang="ts">
	import type { ChatMessage, TripUpdate } from '$lib/types/chat';
	import { chat } from '$lib/stores/chat';
	import { stripTripUpdateBlocks } from '$lib/services/chat-actions';

	export let message: ChatMessage;
	export let pendingActions: TripUpdate[] | undefined = undefined;
	export let applied = false;

	const FIELD_LABELS: Record<string, string> = {
		morning: 'Morning',
		afternoon: 'Afternoon',
		evening: 'Evening',
		travel: 'Travel',
		accommodation: 'Accommodation',
		notes: 'Notes',
		location: 'Location'
	};

	function formatTime(ts: string) {
		const d = new Date(ts);
		return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function displayContent(content: string): string {
		return stripTripUpdateBlocks(content);
	}

	function renderMarkdown(text: string): string {
		// Escape HTML first to prevent XSS
		let html = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// Links: [text](url)
		html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

		// Bold: **text**
		html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

		// Italic: *text* (but not inside already-processed bold)
		html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

		// Inline code: `code`
		html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

		// Numbered lists: lines starting with "1. ", "2. " etc.
		html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');

		// Bullet lists: lines starting with "- " or "* "
		html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

		// Wrap consecutive <li> in <ul>
		html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

		// Newlines to <br> (but not inside <ul> blocks)
		html = html.replace(/\n/g, '<br>');
		// Clean up <br> right after </ul> or before <ul>
		html = html.replace(/<br><ul>/g, '<ul>');
		html = html.replace(/<\/ul><br>/g, '</ul>');
		// Clean up <br> between list items
		html = html.replace(/<\/li><br><li>/g, '</li><li>');

		return html;
	}
</script>

<div class="msg" class:msg--user={message.role === 'user'} class:msg--assistant={message.role === 'assistant'}>
	<div class="msg-bubble">
		{@html renderMarkdown(displayContent(message.content))}

		{#if pendingActions && pendingActions.length > 0}
			<div class="action-block" aria-label="Trip update actions">
				<div class="action-summary">
					{#each pendingActions as action}
						<div class="action-item">
							Day {action.dayIndex + 1} {FIELD_LABELS[action.field] || action.field}: {action.value}
						</div>
					{/each}
				</div>
				<div class="action-buttons">
					<button class="action-btn action-apply" on:click={() => chat.applyActions(message.id)} aria-label="Apply trip updates">
						Apply to trip
					</button>
					<button class="action-btn action-dismiss" on:click={() => chat.dismissActions(message.id)} aria-label="Dismiss trip updates">
						Dismiss
					</button>
				</div>
			</div>
		{/if}

		{#if applied}
			<div class="action-applied" aria-label="Trip updates applied">
				Applied to trip
			</div>
		{/if}
	</div>
	<span class="msg-time">{formatTime(message.timestamp)}</span>
</div>

<style>
	.msg {
		display: flex;
		flex-direction: column;
		max-width: 85%;
		margin-bottom: 0.75rem;
	}

	.msg--user {
		align-self: flex-end;
		align-items: flex-end;
	}

	.msg--assistant {
		align-self: flex-start;
		align-items: flex-start;
	}

	.msg-bubble {
		padding: 0.625rem 0.875rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
		line-height: 1.55;
	}

	.msg--user .msg-bubble {
		background: var(--accent-muted);
		color: var(--ink);
		border-bottom-right-radius: 0.15rem;
	}

	.msg--assistant .msg-bubble {
		background: var(--surface-alt);
		color: var(--ink);
		border: 1px solid var(--border);
		border-bottom-left-radius: 0.15rem;
	}

	.msg-time {
		font-size: 0.65rem;
		color: var(--ink-faint);
		margin-top: 0.2rem;
		padding: 0 0.25rem;
	}

	.msg-bubble :global(strong) {
		font-weight: 600;
	}

	.msg-bubble :global(em) {
		font-style: italic;
	}

	.msg-bubble :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.msg-bubble :global(code) {
		background: var(--surface-alt);
		padding: 0.1em 0.3em;
		border-radius: 3px;
		font-size: 0.85em;
	}

	.msg-bubble :global(ul) {
		margin: 0.35em 0;
		padding-left: 1.25em;
		list-style: disc;
	}

	.msg-bubble :global(li) {
		margin-bottom: 0.2em;
	}

	.action-block {
		margin-top: 0.625rem;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--border);
	}

	.action-summary {
		font-size: 0.78rem;
		color: var(--ink-muted);
		margin-bottom: 0.5rem;
	}

	.action-item {
		padding: 0.2rem 0;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		font-family: var(--font-body);
		font-size: 0.75rem;
		padding: 0.3rem 0.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease;
	}

	.action-apply {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
	}

	.action-apply:hover {
		opacity: 0.85;
	}

	.action-dismiss {
		background: transparent;
		color: var(--ink-faint);
	}

	.action-dismiss:hover {
		background: var(--surface-raised);
		color: var(--ink-muted);
	}

	.action-applied {
		margin-top: 0.5rem;
		padding-top: 0.375rem;
		border-top: 1px dashed var(--border);
		font-size: 0.75rem;
		color: var(--ink-faint);
		font-style: italic;
	}
</style>
