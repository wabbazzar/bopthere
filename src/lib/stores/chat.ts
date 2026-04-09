import { writable, get } from 'svelte/store';
import type { ChatMessage } from '$lib/types/chat';
import type { Trip } from '$lib/types/trip';
import * as chatService from '$lib/services/chat';

interface ChatState {
	messages: ChatMessage[];
	isOpen: boolean;
	isLoading: boolean;
	activeTripId: string | null;
	activeTrip: Trip | null;
	error: string | null;
}

function createChatStore() {
	const { subscribe, set, update } = writable<ChatState>({
		messages: [],
		isOpen: false,
		isLoading: false,
		activeTripId: null,
		activeTrip: null,
		error: null
	});

	let pollInterval: ReturnType<typeof setInterval> | null = null;

	function startPolling() {
		stopPolling();
		pollInterval = setInterval(async () => {
			const state = get({ subscribe });
			if (!state.isOpen || !state.activeTripId) return;
			try {
				const messages = await chatService.getConversation(state.activeTripId);
				update((s) => ({ ...s, messages }));
			} catch {
				// silent poll failure
			}
		}, 10000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	return {
		subscribe,

		async open(tripId: string, trip: Trip) {
			update((s) => ({ ...s, isOpen: true, activeTripId: tripId, activeTrip: trip, isLoading: true, error: null }));
			try {
				const messages = await chatService.getConversation(tripId);
				update((s) => ({ ...s, messages, isLoading: false }));
			} catch {
				update((s) => ({ ...s, isLoading: false, error: 'Failed to load conversation' }));
			}
			startPolling();
		},

		close() {
			update((s) => ({ ...s, isOpen: false }));
			stopPolling();
		},

		toggle(tripId: string, trip: Trip) {
			const state = get({ subscribe });
			if (state.isOpen) {
				this.close();
			} else {
				this.open(tripId, trip);
			}
		},

		async send(message: string) {
			const state = get({ subscribe });
			if (!state.activeTripId || !state.activeTrip) return;

			const userMsg: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: message,
				timestamp: new Date().toISOString()
			};

			update((s) => ({
				...s,
				messages: [...s.messages, userMsg],
				isLoading: true,
				error: null
			}));

			try {
				const assistantMsg = await chatService.sendMessage(state.activeTripId, state.activeTrip, message);
				update((s) => ({
					...s,
					messages: [...s.messages, assistantMsg],
					isLoading: false
				}));
			} catch (e) {
				update((s) => ({
					...s,
					isLoading: false,
					error: e instanceof Error ? e.message : 'Something went wrong'
				}));
			}
		},

		async clear() {
			const state = get({ subscribe });
			if (!state.activeTripId) return;
			await chatService.clearConversation(state.activeTripId);
			update((s) => ({ ...s, messages: [] }));
		}
	};
}

export const chat = createChatStore();
