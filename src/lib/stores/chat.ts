import { writable, get } from 'svelte/store';
import type { ChatMessage, TripUpdate } from '$lib/types/chat';
import type { Trip } from '$lib/types/trip';
import * as chatService from '$lib/services/chat';
import { parseTripUpdates } from '$lib/services/chat-actions';
import { trips } from '$lib/stores/trips';

interface ChatState {
	messages: ChatMessage[];
	isOpen: boolean;
	isLoading: boolean;
	activeTripId: string | null;
	activeTrip: Trip | null;
	error: string | null;
	thinkingMessage: string | null;
	/** Maps message ID → pending updates parsed from that message */
	pendingActions: Record<string, TripUpdate[]>;
	/** Set of message IDs whose actions have been applied */
	appliedActions: Set<string>;
}

const THINKING_MESSAGES = [
	'Thinking about your trip…',
	'Checking flight times…',
	'Consulting the guidebook…',
	'Mapping out options…',
	'Weighing the best picks…',
	'Scouring local reviews…',
	'Crunching travel logistics…',
	'Packing recommendations…',
	'Cross-referencing your itinerary…',
	'Almost there…',
];

const THINKING_ROTATE_MS = 3000;

function createChatStore() {
	const { subscribe, set, update } = writable<ChatState>({
		messages: [],
		isOpen: false,
		isLoading: false,
		activeTripId: null,
		activeTrip: null,
		error: null,
		thinkingMessage: null,
		pendingActions: {},
		appliedActions: new Set<string>()
	});

	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let sendInFlight = false;
	let thinkingInterval: ReturnType<typeof setInterval> | null = null;
	let thinkingIndex = 0;

	function startThinking() {
		stopThinking();
		thinkingIndex = 0;
		update((s) => ({ ...s, thinkingMessage: THINKING_MESSAGES[0] }));
		thinkingInterval = setInterval(() => {
			thinkingIndex = (thinkingIndex + 1) % THINKING_MESSAGES.length;
			update((s) => ({ ...s, thinkingMessage: THINKING_MESSAGES[thinkingIndex] }));
		}, THINKING_ROTATE_MS);
	}

	function stopThinking() {
		if (thinkingInterval) {
			clearInterval(thinkingInterval);
			thinkingInterval = null;
		}
		thinkingIndex = 0;
		update((s) => ({ ...s, thinkingMessage: null }));
	}

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
						// Re-parse any TRIP_UPDATE blocks from history so users
						// can still apply actions from a previous session
						const pendingActions: Record<string, import('$lib/types/chat').TripUpdate[]> = {};
						for (const m of messages) {
							if (m.role === 'assistant') {
								const actions = parseTripUpdates(m.content);
								if (actions.length > 0) pendingActions[m.id] = actions;
							}
						}
						update((s) => ({ ...s, messages, pendingActions, isLoading: false }));
					} else {
						// Send is in-flight — don't touch isLoading or it kills the thinking indicator
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

			startThinking();

			try {
				const assistantMsg = await chatService.sendMessage(state.activeTripId, state.activeTrip, message);
				const actions = parseTripUpdates(assistantMsg.content);
				update((s) => {
					const pendingActions = { ...s.pendingActions };
					if (actions.length > 0) {
						pendingActions[assistantMsg.id] = actions;
					}
					return {
						...s,
						messages: [...s.messages, assistantMsg],
						isLoading: false,
						pendingActions
					};
				});
			} catch (e) {
				update((s) => ({
					...s,
					isLoading: false,
					error: e instanceof Error ? e.message : 'Something went wrong'
				}));
			} finally {
				sendInFlight = false;
				stopThinking();
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

		applyActions(messageId: string) {
			const state = get({ subscribe });
			const actions = state.pendingActions[messageId];
			if (!actions || !state.activeTripId) return;

			for (const action of actions) {
				trips.updateDayField(state.activeTripId, action.dayIndex, action.field, action.value);
			}

			update((s) => {
				const pendingActions = { ...s.pendingActions };
				delete pendingActions[messageId];
				const appliedActions = new Set(s.appliedActions);
				appliedActions.add(messageId);
				return { ...s, pendingActions, appliedActions };
			});
		},

		dismissActions(messageId: string) {
			update((s) => {
				const pendingActions = { ...s.pendingActions };
				delete pendingActions[messageId];
				return { ...s, pendingActions };
			});
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
export { THINKING_MESSAGES, THINKING_ROTATE_MS };
