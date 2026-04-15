import { writable, get } from 'svelte/store';
import type {
	ChatMessage,
	TripUpdate,
	MapLinksAction,
	TripCreate,
	TripDayOp,
	TripMetaAction,
	TripLinkOp,
	TodoOp
} from '$lib/types/chat';
import type { Trip } from '$lib/types/trip';
import * as chatService from '$lib/services/chat';
import {
	parseTripUpdates,
	parseMapLinksActions,
	parseTripCreates,
	parseTripDayOps,
	parseTripMeta,
	parseTripLinkOps,
	parseTodoOps,
	tripFromCreate
} from '$lib/services/chat-actions';
import { trips } from '$lib/stores/trips';
import { todosStore } from '$lib/stores/todos';

interface ChatState {
	messages: ChatMessage[];
	isOpen: boolean;
	isLoading: boolean;
	activeTripId: string | null;
	activeTrip: Trip | null;
	error: string | null;
	thinkingMessage: string | null;
	pendingActions: Record<string, TripUpdate[]>;
	appliedActions: Set<string>;
	pendingMapLinks: Record<string, MapLinksAction[]>;
	appliedMapLinks: Set<string>;
	pendingCreateTrip: Record<string, TripCreate[]>;
	appliedCreateTrip: Set<string>;
	pendingDayOps: Record<string, TripDayOp[]>;
	appliedDayOps: Set<string>;
	pendingMeta: Record<string, TripMetaAction[]>;
	appliedMeta: Set<string>;
	pendingLinkOps: Record<string, TripLinkOp[]>;
	appliedLinkOps: Set<string>;
	pendingTodoOps: Record<string, TodoOp[]>;
	appliedTodoOps: Set<string>;
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

/**
 * Parse every supported action block out of an assistant message and merge
 * them into the relevant pending-action dicts under the message id.
 * Mutates `dicts` in place; returns it for chaining.
 */
function parseIntoDicts(
	content: string,
	messageId: string,
	dicts: {
		actions: Record<string, TripUpdate[]>;
		mapLinks: Record<string, MapLinksAction[]>;
		creates: Record<string, TripCreate[]>;
		dayOps: Record<string, TripDayOp[]>;
		meta: Record<string, TripMetaAction[]>;
		linkOps: Record<string, TripLinkOp[]>;
		todoOps: Record<string, TodoOp[]>;
	}
) {
	const a = parseTripUpdates(content);
	if (a.length) dicts.actions[messageId] = a;
	const ml = parseMapLinksActions(content);
	if (ml.length) dicts.mapLinks[messageId] = ml;
	const c = parseTripCreates(content);
	if (c.length) dicts.creates[messageId] = c;
	const d = parseTripDayOps(content);
	if (d.length) dicts.dayOps[messageId] = d;
	const m = parseTripMeta(content);
	if (m.length) dicts.meta[messageId] = m;
	const l = parseTripLinkOps(content);
	if (l.length) dicts.linkOps[messageId] = l;
	const t = parseTodoOps(content);
	if (t.length) dicts.todoOps[messageId] = t;
	return dicts;
}

function emptyDicts() {
	return {
		actions: {} as Record<string, TripUpdate[]>,
		mapLinks: {} as Record<string, MapLinksAction[]>,
		creates: {} as Record<string, TripCreate[]>,
		dayOps: {} as Record<string, TripDayOp[]>,
		meta: {} as Record<string, TripMetaAction[]>,
		linkOps: {} as Record<string, TripLinkOp[]>,
		todoOps: {} as Record<string, TodoOp[]>
	};
}

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
		appliedActions: new Set<string>(),
		pendingMapLinks: {},
		appliedMapLinks: new Set<string>(),
		pendingCreateTrip: {},
		appliedCreateTrip: new Set<string>(),
		pendingDayOps: {},
		appliedDayOps: new Set<string>(),
		pendingMeta: {},
		appliedMeta: new Set<string>(),
		pendingLinkOps: {},
		appliedLinkOps: new Set<string>(),
		pendingTodoOps: {},
		appliedTodoOps: new Set<string>()
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
						// Re-parse every action block from history so users can
						// still apply proposals from a previous session.
						const d = emptyDicts();
						for (const m of messages) {
							if (m.role === 'assistant') parseIntoDicts(m.content, m.id, d);
						}
						update((s) => ({
							...s,
							messages,
							pendingActions: d.actions,
							pendingMapLinks: d.mapLinks,
							pendingCreateTrip: d.creates,
							pendingDayOps: d.dayOps,
							pendingMeta: d.meta,
							pendingLinkOps: d.linkOps,
							pendingTodoOps: d.todoOps,
							isLoading: false
						}));
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
				update((s) => {
					const d = {
						actions: { ...s.pendingActions },
						mapLinks: { ...s.pendingMapLinks },
						creates: { ...s.pendingCreateTrip },
						dayOps: { ...s.pendingDayOps },
						meta: { ...s.pendingMeta },
						linkOps: { ...s.pendingLinkOps },
						todoOps: { ...s.pendingTodoOps }
					};
					parseIntoDicts(assistantMsg.content, assistantMsg.id, d);
					return {
						...s,
						messages: [...s.messages, assistantMsg],
						isLoading: false,
						pendingActions: d.actions,
						pendingMapLinks: d.mapLinks,
						pendingCreateTrip: d.creates,
						pendingDayOps: d.dayOps,
						pendingMeta: d.meta,
						pendingLinkOps: d.linkOps,
						pendingTodoOps: d.todoOps
					};
				});
			} catch (e) {
				// Backgrounding a mobile tab/PWA kills the in-flight fetch even
				// though the server finishes and persists the reply. Before
				// surfacing an error, refetch once — if the server has our
				// assistant reply, swap it in without dropping the thinking
				// indicator, so the user sees no error flash.
				const preSendCount = state.messages.length;
				let recovered = false;
				try {
					const serverMessages = await chatService.getConversation(state.activeTripId);
					const last = serverMessages[serverMessages.length - 1];
					if (serverMessages.length >= preSendCount + 2 && last?.role === 'assistant') {
						update((s) => {
							const d = {
								actions: { ...s.pendingActions },
								mapLinks: { ...s.pendingMapLinks },
								creates: { ...s.pendingCreateTrip },
								dayOps: { ...s.pendingDayOps },
								meta: { ...s.pendingMeta },
								linkOps: { ...s.pendingLinkOps },
								todoOps: { ...s.pendingTodoOps }
							};
							parseIntoDicts(last.content, last.id, d);
							return {
								...s,
								messages: serverMessages,
								isLoading: false,
								pendingActions: d.actions,
								pendingMapLinks: d.mapLinks,
								pendingCreateTrip: d.creates,
								pendingDayOps: d.dayOps,
								pendingMeta: d.meta,
								pendingLinkOps: d.linkOps,
								pendingTodoOps: d.todoOps
							};
						});
						recovered = true;
					}
				} catch {
					// verify itself failed — fall through to show original error
				}
				if (!recovered) {
					update((s) => ({
						...s,
						isLoading: false,
						error: e instanceof Error ? e.message : 'Something went wrong'
					}));
				}
			} finally {
				sendInFlight = false;
				stopThinking();
			}
		},

		/**
		 * Open chat (using an existing trip for context) and prompt the agent
		 * to start planning a new trip. The agent emits a TRIP_CREATE block
		 * which the user can apply.
		 */
		planNewTrip(contextTripId: string, contextTrip: Trip) {
			sendInFlight = true;
			const state = get({ subscribe });
			if (!state.isOpen) {
				this.open(contextTripId, contextTrip);
			}
			setTimeout(() => this.send("Let's plan a new trip."), 300);
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

		applyMapLinks(messageId: string) {
			const state = get({ subscribe });
			const actions = state.pendingMapLinks[messageId];
			if (!actions || !state.activeTripId) return;

			for (const action of actions) {
				trips.setDayMapLinks(state.activeTripId, action.dayIndex, action.mapLinks);
			}

			update((s) => {
				const pendingMapLinks = { ...s.pendingMapLinks };
				delete pendingMapLinks[messageId];
				const appliedMapLinks = new Set(s.appliedMapLinks);
				appliedMapLinks.add(messageId);
				return { ...s, pendingMapLinks, appliedMapLinks };
			});
		},

		dismissMapLinks(messageId: string) {
			update((s) => {
				const pendingMapLinks = { ...s.pendingMapLinks };
				delete pendingMapLinks[messageId];
				return { ...s, pendingMapLinks };
			});
		},

		applyCreateTrip(messageId: string): string | null {
			const state = get({ subscribe });
			const creates = state.pendingCreateTrip[messageId];
			if (!creates || creates.length === 0) return null;

			let createdId: string | null = null;
			for (const tc of creates) {
				const trip = tripFromCreate(tc);
				if (trips.addTrip(trip)) {
					createdId = trip.id;
				}
			}

			update((s) => {
				const pendingCreateTrip = { ...s.pendingCreateTrip };
				delete pendingCreateTrip[messageId];
				const appliedCreateTrip = new Set(s.appliedCreateTrip);
				appliedCreateTrip.add(messageId);
				return { ...s, pendingCreateTrip, appliedCreateTrip };
			});

			// Navigate to the new trip so the user immediately sees it.
			// Dynamic import so this file stays testable outside a SvelteKit runtime.
			if (createdId) {
				import('$app/navigation')
					.then(({ goto }) => goto(`/trip/${createdId}`))
					.catch(() => {
						// navigation unavailable (tests/SSR) — trip is still in the store
					});
			}
			return createdId;
		},

		dismissCreateTrip(messageId: string) {
			update((s) => {
				const pendingCreateTrip = { ...s.pendingCreateTrip };
				delete pendingCreateTrip[messageId];
				return { ...s, pendingCreateTrip };
			});
		},

		applyDayOps(messageId: string) {
			const state = get({ subscribe });
			const ops = state.pendingDayOps[messageId];
			if (!ops || !state.activeTripId) return;
			const id = state.activeTripId;
			for (const op of ops) {
				if (op.op === 'add') trips.addDay(id, op.afterIndex);
				else if (op.op === 'delete') trips.deleteDay(id, op.dayIndex);
				else if (op.op === 'duplicate') trips.duplicateDay(id, op.dayIndex);
				else if (op.op === 'move') trips.moveDay(id, op.dayIndex, op.direction);
			}
			update((s) => {
				const pendingDayOps = { ...s.pendingDayOps };
				delete pendingDayOps[messageId];
				const appliedDayOps = new Set(s.appliedDayOps);
				appliedDayOps.add(messageId);
				return { ...s, pendingDayOps, appliedDayOps };
			});
		},

		dismissDayOps(messageId: string) {
			update((s) => {
				const pendingDayOps = { ...s.pendingDayOps };
				delete pendingDayOps[messageId];
				return { ...s, pendingDayOps };
			});
		},

		applyMeta(messageId: string) {
			const state = get({ subscribe });
			const metas = state.pendingMeta[messageId];
			if (!metas || !state.activeTripId) return;
			const id = state.activeTripId;
			for (const m of metas) {
				if (typeof m.name === 'string') trips.updateTrip(id, 'name', m.name);
				if (typeof m.startDate === 'string') trips.updateTrip(id, 'startDate', m.startDate);
				if (typeof m.endDate === 'string') trips.updateTrip(id, 'endDate', m.endDate);
				if (Array.isArray(m.destinations)) trips.updateDestinations(id, m.destinations);
			}
			update((s) => {
				const pendingMeta = { ...s.pendingMeta };
				delete pendingMeta[messageId];
				const appliedMeta = new Set(s.appliedMeta);
				appliedMeta.add(messageId);
				return { ...s, pendingMeta, appliedMeta };
			});
		},

		dismissMeta(messageId: string) {
			update((s) => {
				const pendingMeta = { ...s.pendingMeta };
				delete pendingMeta[messageId];
				return { ...s, pendingMeta };
			});
		},

		applyLinkOps(messageId: string) {
			const state = get({ subscribe });
			const ops = state.pendingLinkOps[messageId];
			if (!ops || !state.activeTripId) return;
			const id = state.activeTripId;
			for (const op of ops) {
				if (op.op === 'add') trips.addLink(id, op.url);
				else if (op.op === 'update') trips.updateLink(id, op.linkIndex, op.url);
				else if (op.op === 'delete') trips.deleteLink(id, op.linkIndex);
			}
			update((s) => {
				const pendingLinkOps = { ...s.pendingLinkOps };
				delete pendingLinkOps[messageId];
				const appliedLinkOps = new Set(s.appliedLinkOps);
				appliedLinkOps.add(messageId);
				return { ...s, pendingLinkOps, appliedLinkOps };
			});
		},

		dismissLinkOps(messageId: string) {
			update((s) => {
				const pendingLinkOps = { ...s.pendingLinkOps };
				delete pendingLinkOps[messageId];
				return { ...s, pendingLinkOps };
			});
		},

		applyTodoOps(messageId: string) {
			const state = get({ subscribe });
			const ops = state.pendingTodoOps[messageId];
			if (!ops || !state.activeTripId) return;
			const id = state.activeTripId;
			// Make sure the store has the latest view of todos before mutating,
			// so the agent's indices line up with what the user sees.
			todosStore.init(id);
			for (const op of ops) {
				if (op.op === 'add') todosStore.add(id, op.text);
				else if (op.op === 'update') todosStore.updateText(id, op.todoIndex, op.text);
				else if (op.op === 'toggle') todosStore.toggle(id, op.todoIndex);
				else if (op.op === 'delete') todosStore.remove(id, op.todoIndex);
			}
			update((s) => {
				const pendingTodoOps = { ...s.pendingTodoOps };
				delete pendingTodoOps[messageId];
				const appliedTodoOps = new Set(s.appliedTodoOps);
				appliedTodoOps.add(messageId);
				return { ...s, pendingTodoOps, appliedTodoOps };
			});
		},

		dismissTodoOps(messageId: string) {
			update((s) => {
				const pendingTodoOps = { ...s.pendingTodoOps };
				delete pendingTodoOps[messageId];
				return { ...s, pendingTodoOps };
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
