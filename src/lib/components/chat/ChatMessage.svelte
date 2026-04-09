<script lang="ts">
	import type { ChatMessage } from '$lib/types/chat';

	export let message: ChatMessage;

	function formatTime(ts: string) {
		const d = new Date(ts);
		return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}
</script>

<div class="msg" class:msg--user={message.role === 'user'} class:msg--assistant={message.role === 'assistant'}>
	<div class="msg-bubble">
		{@html message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}
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
</style>
