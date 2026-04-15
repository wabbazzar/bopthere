import { writable, get } from 'svelte/store';
import type { Trip, TripDay, MapLink } from '$lib/types/trip';
import { chinaTrip } from '$lib/data/china-2026';

const STORAGE_KEY = 'hw-trips';
const META_KEY = 'hw-trips-meta';
const SYNC_PENDING_KEY = 'hw-trips-sync-pending';
const UNDO_LIMIT = 50;
const SYNC_DEBOUNCE_MS = 2000;

// Default trips keyed by id — deep frozen copy so mutations never leak back
const defaults: Record<string, Trip> = JSON.parse(JSON.stringify({
	'china-2026': chinaTrip
}));

/** Deep-clone defaults so store mutations never corrupt the originals */
function cloneDefaults(): Record<string, Trip> {
	return JSON.parse(JSON.stringify(defaults));
}

/**
 * Derive the header destinations list from day locations, excluding split-day
 * locations like "Zhangjiajie / Shanghai" — those transit/overlap days already
 * show up individually and their component cities already have dedicated days.
 */
function computeDestinations(days: TripDay[]): string[] {
	return [
		...new Set(
			days
				.map((d) => d.location)
				.filter((loc): loc is string => Boolean(loc) && !loc.includes('/'))
		)
	];
}

function loadTrips(): Record<string, Trip> {
	if (typeof localStorage === 'undefined') return normalizeTrips(cloneDefaults());
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return normalizeTrips(cloneDefaults());
	try {
		const saved = JSON.parse(raw) as Record<string, Trip>;
		return normalizeTrips({ ...cloneDefaults(), ...saved });
	} catch {
		return normalizeTrips(cloneDefaults());
	}
}

/** Recompute derived fields (destinations) for every trip — heals legacy state */
function normalizeTrips(trips: Record<string, Trip>): Record<string, Trip> {
	for (const trip of Object.values(trips)) {
		trip.destinations = computeDestinations(trip.days);
	}
	return trips;
}

function saveTrips(trips: Record<string, Trip>) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

// ── Server sync metadata (per-trip updatedAt timestamps) ────────

function loadMeta(): Record<string, string> {
	if (typeof localStorage === 'undefined') return {};
	try {
		return JSON.parse(localStorage.getItem(META_KEY) || '{}');
	} catch {
		return {};
	}
}

function saveMetaField(tripId: string, updatedAt: string) {
	if (typeof localStorage === 'undefined') return;
	const meta = loadMeta();
	meta[tripId] = updatedAt;
	localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function createTripsStore() {
	const { subscribe, set, update } = writable<Record<string, Trip>>(loadTrips());
	const undoStack: string[] = [];
	const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function snapshot(trips: Record<string, Trip>) {
		undoStack.push(JSON.stringify(trips));
		if (undoStack.length > UNDO_LIMIT) undoStack.shift();
	}

	/**
	 * Persist to localStorage (instant) and schedule a debounced PUT to
	 * the server. Every mutation calls this instead of raw saveTrips().
	 */
	function persistAndSync(trips: Record<string, Trip>, tripId: string) {
		saveTrips(trips);
		const now = new Date().toISOString();
		saveMetaField(tripId, now);
		scheduleSyncToServer(tripId);
	}

	function scheduleSyncToServer(tripId: string) {
		const existing = syncTimers.get(tripId);
		if (existing) clearTimeout(existing);
		syncTimers.set(tripId, setTimeout(() => {
			syncTimers.delete(tripId);
			pushToServer(tripId);
		}, SYNC_DEBOUNCE_MS));
	}

	/** Push local trip state to the server. On 409 (stale), accept server version. */
	async function pushToServer(tripId: string) {
		try {
			const { saveTrip } = await import('$lib/services/trips-api');
			const trips = get({ subscribe });
			const trip = trips[tripId];
			if (!trip) return;
			const meta = loadMeta();
			const updatedAt = meta[tripId] || new Date().toISOString();
			const result = await saveTrip(tripId, trip, updatedAt);
			if (result.ok) {
				saveMetaField(tripId, result.updatedAt);
				clearSyncPending(tripId);
			} else if (result.serverTrip) {
				// Server had newer data — accept it
				update((t) => {
					t[tripId] = normalizeTrips({ [tripId]: result.serverTrip! })[tripId];
					saveTrips(t);
					return { ...t };
				});
				saveMetaField(tripId, result.updatedAt);
				clearSyncPending(tripId);
			}
		} catch {
			// Network error — mark pending for retry when online
			markSyncPending(tripId);
		}
	}

	/** Pull server state on init. Server is authoritative — always use it if available. */
	async function pullFromServer(tripId: string) {
		try {
			const { fetchTrip, saveTrip } = await import('$lib/services/trips-api');
			const serverResult = await fetchTrip(tripId);

			if (serverResult === null) {
				// Server has no row — push current local state (first-user migration)
				const trips = get({ subscribe });
				const trip = trips[tripId];
				if (trip) {
					const now = new Date().toISOString();
					const result = await saveTrip(tripId, trip, now);
					if (result.ok) saveMetaField(tripId, result.updatedAt);
				}
			} else {
				// Server has data — always use it. The server is the source of
				// truth; localStorage is just a cache for offline + instant render.
				update((trips) => {
					trips[tripId] = normalizeTrips({ [tripId]: serverResult.trip })[tripId];
					saveTrips(trips);
					return { ...trips };
				});
				saveMetaField(tripId, serverResult.updatedAt);
			}
		} catch {
			// Offline — use localStorage as-is
		}
	}

	function markSyncPending(tripId: string) {
		if (typeof localStorage === 'undefined') return;
		const pending = new Set((localStorage.getItem(SYNC_PENDING_KEY) || '').split(',').filter(Boolean));
		pending.add(tripId);
		localStorage.setItem(SYNC_PENDING_KEY, [...pending].join(','));
	}

	function clearSyncPending(tripId: string) {
		if (typeof localStorage === 'undefined') return;
		const pending = new Set((localStorage.getItem(SYNC_PENDING_KEY) || '').split(',').filter(Boolean));
		pending.delete(tripId);
		if (pending.size === 0) localStorage.removeItem(SYNC_PENDING_KEY);
		else localStorage.setItem(SYNC_PENDING_KEY, [...pending].join(','));
	}

	/** On page load: push any unsaved edits, then pull server state. */
	async function initSync(tripId: string) {
		// If there are pending local edits from a previous session, push first
		if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem(SYNC_PENDING_KEY);
			if (raw && raw.split(',').includes(tripId)) {
				await pushToServer(tripId);
			}
		}
		// Then pull (server always wins after any pending push)
		await pullFromServer(tripId);
	}

	function flushPendingSyncs() {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(SYNC_PENDING_KEY);
		if (!raw) return;
		const pending = raw.split(',').filter(Boolean);
		for (const tripId of pending) {
			scheduleSyncToServer(tripId);
		}
	}

	// Listen for online recovery
	if (typeof window !== 'undefined') {
		window.addEventListener('online', () => flushPendingSyncs());
	}

	return {
		subscribe,

		init() {
			set(loadTrips());
			// Async: for each trip, flush any unsaved edits first, then
			// pull from server (server is authoritative on load).
			const trips = get({ subscribe });
			for (const tripId of Object.keys(trips)) {
				initSync(tripId);
			}
		},

		getTrip(id: string): Trip | undefined {
			return get({ subscribe })[id];
		},

		// Update a single field on the trip
		updateTrip(id: string, field: keyof Omit<Trip, 'id' | 'days' | 'links'>, value: string) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				(trip as unknown as Record<string, unknown>)[field] = value;
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		// Update destinations array
		updateDestinations(id: string, destinations: string[]) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.destinations = destinations;
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		// Update a cell in a day
		updateDayField(id: string, dayIndex: number, field: keyof TripDay, value: string | boolean) {
			update((trips) => {
				const trip = trips[id];
				if (!trip || !trip.days[dayIndex]) return trips;
				snapshot(trips);
				(trip.days[dayIndex] as unknown as Record<string, unknown>)[field] = value;

				// Auto-update dayOfWeek when date changes
				if (field === 'date' && typeof value === 'string') {
					const d = new Date(value + 'T12:00:00');
					if (!isNaN(d.getTime())) {
						trip.days[dayIndex].dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
					}
				}

				// Auto-update trip startDate/endDate from days
				const dates = trip.days.map((d) => d.date).filter(Boolean).sort();
				if (dates.length) {
					trip.startDate = dates[0];
					trip.endDate = dates[dates.length - 1];
				}

				// Auto-update destinations from unique locations
				trip.destinations = computeDestinations(trip.days);

				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		// Add a new day
		addDay(id: string, afterIndex?: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);

				const lastDay = trip.days[afterIndex ?? trip.days.length - 1];
				let nextDate = '';
				if (lastDay?.date) {
					const d = new Date(lastDay.date + 'T12:00:00');
					d.setDate(d.getDate() + 1);
					nextDate = d.toISOString().split('T')[0];
				}
				const newDay: TripDay = {
					date: nextDate,
					dayOfWeek: nextDate
						? new Date(nextDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
						: '',
					location: lastDay?.location || '',
					travel: '',
					morning: '',
					afternoon: '',
					evening: '',
					accommodation: '',
					notes: '',
					ooo: false
				};

				const idx = afterIndex !== undefined ? afterIndex + 1 : trip.days.length;
				trip.days.splice(idx, 0, newDay);

				// Update trip dates
				const dates = trip.days.map((d) => d.date).filter(Boolean).sort();
				if (dates.length) {
					trip.startDate = dates[0];
					trip.endDate = dates[dates.length - 1];
				}

				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		// Delete a day
		deleteDay(id: string, dayIndex: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip || trip.days.length <= 1) return trips;
				snapshot(trips);
				trip.days.splice(dayIndex, 1);

				const dates = trip.days.map((d) => d.date).filter(Boolean).sort();
				if (dates.length) {
					trip.startDate = dates[0];
					trip.endDate = dates[dates.length - 1];
				}
				trip.destinations = computeDestinations(trip.days);

				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		// Move a day up or down
		moveDay(id: string, dayIndex: number, direction: 'up' | 'down') {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				const newIndex = direction === 'up' ? dayIndex - 1 : dayIndex + 1;
				if (newIndex < 0 || newIndex >= trip.days.length) return trips;
				snapshot(trips);
				const [day] = trip.days.splice(dayIndex, 1);
				trip.days.splice(newIndex, 0, day);
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		// Duplicate a day
		duplicateDay(id: string, dayIndex: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				const copy = { ...trip.days[dayIndex] };
				if (copy.date) {
					const d = new Date(copy.date + 'T12:00:00');
					d.setDate(d.getDate() + 1);
					copy.date = d.toISOString().split('T')[0];
					copy.dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
				}
				trip.days.splice(dayIndex + 1, 0, copy);
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		// Links management
		addLink(id: string, url: string) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links.push(url);
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		updateLink(id: string, linkIndex: number, url: string) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links[linkIndex] = url;
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		deleteLink(id: string, linkIndex: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links.splice(linkIndex, 1);
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		setDayMapLinks(id: string, dayIndex: number, mapLinks: MapLink[]) {
			update((trips) => {
				const trip = trips[id];
				if (!trip || !trip.days[dayIndex]) return trips;
				snapshot(trips);
				trip.days[dayIndex].mapLinks = mapLinks;
				persistAndSync(trips, id);
				return { ...trips };
			});
		},

		undo() {
			const prev = undoStack.pop();
			if (!prev) return;
			const trips = JSON.parse(prev);
			set(trips);
			saveTrips(trips);
			// Sync all trips after undo
			for (const tripId of Object.keys(trips)) {
				const now = new Date().toISOString();
				saveMetaField(tripId, now);
				scheduleSyncToServer(tripId);
			}
		},

		canUndo(): boolean {
			return undoStack.length > 0;
		},

		// Reset trip to defaults
		resetTrip(id: string) {
			update((trips) => {
				if (defaults[id]) {
					snapshot(trips);
					trips[id] = JSON.parse(JSON.stringify(defaults[id]));
					persistAndSync(trips, id);
				}
				return { ...trips };
			});
		},

		// Export trip as JSON
		exportTrip(id: string): string {
			const trips = get({ subscribe });
			const trip = trips[id];
			if (!trip) return '';
			return JSON.stringify(trip, null, 2);
		},

		/**
		 * Add a brand-new trip to the store. Returns false if the id already
		 * exists (refuse to overwrite). On success, persists locally and
		 * pushes to the server via the normal debounced sync.
		 */
		addTrip(trip: Trip): boolean {
			const current = get({ subscribe });
			if (current[trip.id]) return false;
			let accepted = false;
			update((trips) => {
				if (trips[trip.id]) return trips;
				snapshot(trips);
				const clone = JSON.parse(JSON.stringify(trip)) as Trip;
				clone.destinations = computeDestinations(clone.days);
				trips[trip.id] = clone;
				persistAndSync(trips, trip.id);
				accepted = true;
				return { ...trips };
			});
			return accepted;
		}
	};
}

export const trips = createTripsStore();
