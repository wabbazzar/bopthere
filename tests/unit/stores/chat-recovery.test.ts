import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import type { ChatMessage } from '$lib/types/chat';
import type { Trip } from '$lib/types/trip';

// Mock the chat service module so we control send/getConversation outcomes.
vi.mock('$lib/services/chat', () => ({
	sendMessage: vi.fn(),
	getConversation: vi.fn(),
	clearConversation: vi.fn().mockResolvedValue(undefined),
	buildSuggestionMessage: vi.fn(() => '')
}));

// Mock the trips store so importing chat.ts doesn't touch localStorage/defaults.
vi.mock('$lib/stores/trips', () => ({
	trips: {
		updateDayField: vi.fn(),
		setDayMapLinks: vi.fn()
	}
}));

function makeTrip(): Trip {
	return {
		id: 'test-trip',
		name: 'Test Trip',
		startDate: '2026-04-22',
		endDate: '2026-04-23',
		destinations: ['Shanghai'],
		links: [],
		days: [
			{
				date: '2026-04-22',
				dayOfWeek: 'Wed',
				location: 'Shanghai',
				travel: '',
				morning: '',
				afternoon: '',
				evening: '',
				accommodation: '',
				notes: '',
				ooo: false
			}
		]
	};
}

function makeMsg(role: 'user' | 'assistant', content: string, id?: string): ChatMessage {
	return {
		id: id ?? crypto.randomUUID(),
		role,
		content,
		timestamp: new Date().toISOString()
	};
}

describe('chat store — failed-fetch recovery', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('recovers silently when sendMessage rejects but server persisted the reply', async () => {
		const chatService = await import('$lib/services/chat');
		const { chat } = await import('$lib/stores/chat');

		(chatService.getConversation as any).mockResolvedValueOnce([]); // initial open()
		chat.open('test-trip', makeTrip());
		await Promise.resolve();
		await Promise.resolve();

		// Simulate backgrounded tab: fetch rejects, but server has the reply
		const savedUser = makeMsg('user', 'hello', 'u1');
		const savedAssistant = makeMsg('assistant', 'hi there', 'a1');
		(chatService.sendMessage as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
		(chatService.getConversation as any).mockResolvedValueOnce([savedUser, savedAssistant]);

		await chat.send('hello');

		const state = get(chat);
		expect(state.error).toBeNull();
		expect(state.isLoading).toBe(false);
		expect(state.messages).toHaveLength(2);
		expect(state.messages[1].role).toBe('assistant');
		expect(state.messages[1].content).toBe('hi there');

		chat.close();
	});

	it('surfaces the error when sendMessage rejects AND server has no new reply', async () => {
		const chatService = await import('$lib/services/chat');
		const { chat } = await import('$lib/stores/chat');

		(chatService.getConversation as any).mockResolvedValueOnce([]); // initial open()
		chat.open('test-trip', makeTrip());
		await Promise.resolve();
		await Promise.resolve();

		// Genuine failure: fetch rejects AND server has nothing new
		(chatService.sendMessage as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
		(chatService.getConversation as any).mockResolvedValueOnce([]);

		await chat.send('hello');

		const state = get(chat);
		expect(state.error).toBe('Failed to fetch');
		expect(state.isLoading).toBe(false);

		chat.close();
	});

	it('surfaces the original error when the verify refetch itself also fails', async () => {
		const chatService = await import('$lib/services/chat');
		const { chat } = await import('$lib/stores/chat');

		(chatService.getConversation as any).mockResolvedValueOnce([]); // initial open()
		chat.open('test-trip', makeTrip());
		await Promise.resolve();
		await Promise.resolve();

		(chatService.sendMessage as any).mockRejectedValueOnce(new Error('boom'));
		(chatService.getConversation as any).mockRejectedValueOnce(new Error('still down'));

		await chat.send('hello');

		const state = get(chat);
		expect(state.error).toBe('boom');
		expect(state.isLoading).toBe(false);

		chat.close();
	});
});
