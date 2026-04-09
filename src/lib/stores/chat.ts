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
	let sendInFlight = false;

	function startPolling() {
		stopPolling();
		pollInterval = setInterval(async () => {
			const state = get({ subscribe });
			if (!state.isOpen || !state.activeTripId) return;
			// Never overwrite messages while a send is in-flight —
			// the optimistic user message would vanish because the
			// server hasn't processed it yet.
			if (sendInFlight) return;
			try {
				const messages = await chatService.getConversation(state.activeTripId);
				// Double-check: send could have started while we were fetching
				if (!sendInFlight) {
					update((s) => ({ ...s, messages }));
				}
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

		open(tripId: string, trip: Trip) {
			update((s) => ({ ...s, isOpen: true, activeTripId: tripId, activeTrip: trip, isLoading: true, error: null }));
			chatService.getConversation(tripId)
				.then((messages) => {
					// Don't overwrite if a send started while we were loading
					if (!sendInFlight) {
						update((s) => ({ ...s, messages, isLoading: false }));
					} else {
						update((s) => ({ ...s, isLoading: false }));
					}
				})
				.catch(() => update((s) => ({ ...s, isLoading: false, error: 'Failed to load conversation' })));
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

			// Mark send in-flight so polling doesn't clobber the optimistic message
			sendInFlight = true;

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
			} finally {
				sendInFlight = false;
			}
		},

		sendSuggestion(tripId: string, trip: Trip, dayIndex: number, slot: 'morning' | 'afternoon' | 'evening', energy: string, interest: string) {
			const message = chatService.buildSuggestionMessage(trip, dayIndex, slot, energy, interest);
			if (!message) return;

			// Mark send intent immediately so open()'s fetch doesn't clobber
			// the optimistic message we're about to add
			sendInFlight = true;

			const state = get({ subscribe });
			if (!state.isOpen) {
				this.open(tripId, trip);
			}

			// Delay to let drawer render, then send
			setTimeout(() => this.send(message), 300);
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
