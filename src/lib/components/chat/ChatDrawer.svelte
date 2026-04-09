<script lang="ts">
	import { chat } from '$lib/stores/chat';
	import ChatMessage from './ChatMessage.svelte';
	import { tick } from 'svelte';

	let inputValue = '';
	let messagesEl: HTMLElement;

	// Only scroll when message count changes, not on every store update
	let prevMsgCount = 0;
	$: {
		const count = $chat.messages.length;
		if (count > prevMsgCount && messagesEl) {
			prevMsgCount = count;
			tick().then(() => {
				if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
			});
		}
	}

	function handleSend() {
		const msg = inputValue.trim();
		if (!msg || $chat.isLoading) return;
		inputValue = '';
		chat.send(msg); // fire-and-forget — store handles loading state
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}
</script>

{#if $chat.isOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="backdrop" on:click={() => chat.close()}></div>

	<div class="drawer">
		<div class="drawer-header">
			<div class="drawer-title">
				<span class="section-label" style="margin:0; font-size: 0.65rem;">Trip Assistant</span>
			</div>
			<div class="drawer-actions">
				<button class="drawer-btn" on:click={() => chat.clear()} title="Clear conversation">
					Clear
				</button>
				<button class="drawer-btn drawer-close" on:click={() => chat.close()}>
					&times;
				</button>
			</div>
		</div>

		<div class="drawer-messages" bind:this={messagesEl}>
			{#if $chat.messages.length === 0 && !$chat.isLoading}
				<div class="empty-state">
					<p>Ask about your trip — restaurants, activities, logistics</p>
				</div>
			{/if}

			{#each $chat.messages as message (message.id)}
				<ChatMessage {message} />
			{/each}

			{#if $chat.isLoading}
				<div class="typing">
					<span class="dot"></span><span class="dot"></span><span class="dot"></span>
				</div>
			{/if}

			{#if $chat.error}
				<p class="error-msg">{$chat.error}</p>
			{/if}
		</div>

		<div class="drawer-input">
			<input
				type="text"
				bind:value={inputValue}
				on:keydown={handleKeydown}
				placeholder="Ask about your trip..."
				class="input-themed"
				disabled={$chat.isLoading}
			/>
			<button
				class="btn-primary send-btn"
				on:click={handleSend}
				disabled={!inputValue.trim() || $chat.isLoading}
			>
				&uarr;
			</button>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(61, 43, 31, 0.3);
		z-index: 40;
		animation: fadeIn 200ms ease;
	}

	.drawer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: 70dvh;
		max-height: 600px;
		background: var(--surface);
		border-top: 1px solid var(--border);
		border-radius: 1rem 1rem 0 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		animation: slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 -4px 30px rgba(61, 43, 31, 0.12);
	}

	@media (min-width: 640px) {
		.drawer {
			max-width: 480px;
			right: 1.5rem;
			left: auto;
			border-radius: 1rem 1rem 0 0;
		}
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.drawer-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.drawer-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.drawer-btn {
		background: none;
		border: none;
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: var(--ink-faint);
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius);
		transition: color 150ms ease, background-color 150ms ease;
	}

	.drawer-btn:hover {
		color: var(--ink-muted);
		background: var(--accent-muted);
	}

	.drawer-close {
		font-size: 1.25rem;
		line-height: 1;
		padding: 0.125rem 0.375rem;
	}

	.drawer-messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		text-align: center;
		color: var(--ink-faint);
		font-size: 0.85rem;
		padding: 2rem;
	}

	.drawer-input {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--border);
		background: var(--surface-raised);
		flex-shrink: 0;
	}

	.drawer-input input {
		flex: 1;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
	}

	.send-btn {
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		flex-shrink: 0;
		border-radius: 50%;
	}

	.typing {
		display: flex;
		gap: 0.3rem;
		padding: 0.625rem 0.875rem;
		align-self: flex-start;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink-faint);
		animation: bounce 1.2s infinite;
	}

	.dot:nth-child(2) { animation-delay: 0.15s; }
	.dot:nth-child(3) { animation-delay: 0.3s; }

	.error-msg {
		font-size: 0.78rem;
		color: var(--danger);
		padding: 0.5rem 0;
		align-self: center;
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes bounce {
		0%, 60%, 100% { transform: translateY(0); }
		30% { transform: translateY(-4px); }
	}
</style>
