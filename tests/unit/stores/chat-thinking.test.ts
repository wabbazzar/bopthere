import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { THINKING_MESSAGES, THINKING_ROTATE_MS } from '$lib/stores/chat';

describe('chat thinking messages', () => {
	describe('THINKING_MESSAGES', () => {
		it('has at least 5 messages', () => {
			expect(THINKING_MESSAGES.length).toBeGreaterThanOrEqual(5);
		});

		it('every message is a non-empty string', () => {
			for (const msg of THINKING_MESSAGES) {
				expect(typeof msg).toBe('string');
				expect(msg.length).toBeGreaterThan(0);
			}
		});

		it('has no duplicate messages', () => {
			const unique = new Set(THINKING_MESSAGES);
			expect(unique.size).toBe(THINKING_MESSAGES.length);
		});
	});

	describe('THINKING_ROTATE_MS', () => {
		it('is a positive number between 1s and 10s', () => {
			expect(THINKING_ROTATE_MS).toBeGreaterThanOrEqual(1000);
			expect(THINKING_ROTATE_MS).toBeLessThanOrEqual(10000);
		});
	});

	describe('store thinking state', () => {
		// The chat store integrates with chatService which needs mocking for full
		// send() tests. Here we test the exported constants and verify the store
		// shape includes thinkingMessage.
		it('store initial state has thinkingMessage as null', async () => {
			const { get } = await import('svelte/store');
			const { chat } = await import('$lib/stores/chat');
			const state = get(chat);
			expect(state.thinkingMessage).toBeNull();
		});
	});
});
