import { writable, get } from 'svelte/store';
import type { Trip, TripDay, MapLink } from '$lib/types/trip';
import { chinaTrip } from '$lib/data/china-2026';
import { dbGet, dbPut, dbDelete, dbGetAll } from '$lib/stores/db';

const UNDO_LIMIT = 50;
const SYNC_DEBOUNCE_MS = 2000;

const isBrowser = typeof window !== 'undefined';

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
 * locations like "Zhangjiajie / Shanghai".
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

/** Recompute derived fields (destinations) for every trip — heals legacy state */
function normalizeTrips(trips: Record<string, Trip>): Record<string, Trip> {
	for (const trip of Object.values(trips)) {
		trip.destinations = computeDestinations(trip.days);
	}
	return trips;
}

function createTripsStore() {
	// Start with defaults — init() will hydrate from IndexedDB + server
	const { subscribe, set, update } = writable<Record<string, Trip>>(normalizeTrips(cloneDefaults()));
	const undoStack: string[] = [];
	const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function snapshot(trips: Record<string, Trip>) {
		undoStack.push(JSON.stringify(trips));
		if (undoStack.length > UNDO_LIMIT) undoStack.shift();
	}

	/**
	 * Persist to IndexedDB and schedule a debounced PUT to the server.
	 */
	function persistAndSync(trips: Record<string, Trip>, tripId: string) {
		saveTrips(trips);
		const now = new Date().toISOString();
		saveMetaField(tripId, now);
		scheduleSyncToServer(tripId);
	}

	function saveTrips(trips: Record<string, Trip>) {
		if (!isBrowser) return;
		// Save each trip as its own IndexedDB row
		for (const [id, trip] of Object.entries(trips)) {
			dbPut('trips', id, trip).catch(() => {});
		}
	}

	async function loadMeta(): Promise<Record<string, string>> {
		const meta = await dbGet<Record<string, string>>('meta', 'hw-trips-meta');
		return meta ?? {};
	}

	function saveMetaField(tripId: string, updatedAt: string) {
		if (!isBrowser) return;
		loadMeta().then((meta) => {
			meta[tripId] = updatedAt;
			dbPut('meta', 'hw-trips-meta', meta).catch(() => {});
		});
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
			const meta = await loadMeta();
			const updatedAt = meta[tripId] || new Date().toISOString();
			const result = await saveTrip(tripId, trip, updatedAt);
			if (result.ok) {
				saveMetaField(tripId, result.updatedAt);
				clearSyncPending(tripId);
			} else if (result.serverTrip) {
				update((t) => {
					t[tripId] = normalizeTrips({ [tripId]: result.serverTrip! })[tripId];
					saveTrips(t);
					return { ...t };
				});
				saveMetaField(tripId, result.updatedAt);
				clearSyncPending(tripId);
			}
		} catch {
			markSyncPending(tripId);
		}
	}

	/** Pull server state on init. Server is authoritative. */
	async function pullFromServer(tripId: string) {
		try {
			const { fetchTrip, saveTrip } = await import('$lib/services/trips-api');
			const serverResult = await fetchTrip(tripId);

			if (serverResult === null) {
				const trips = get({ subscribe });
				const trip = trips[tripId];
				if (trip) {
					const now = new Date().toISOString();
					const result = await saveTrip(tripId, trip, now);
					if (result.ok) saveMetaField(tripId, result.updatedAt);
				}
			} else {
				update((trips) => {
					trips[tripId] = normalizeTrips({ [tripId]: serverResult.trip })[tripId];
					saveTrips(trips);
					return { ...trips };
				});
				saveMetaField(tripId, serverResult.updatedAt);
			}
		} catch {
			// Offline — use IndexedDB as-is
		}
	}

	function markSyncPending(tripId: string) {
		if (!isBrowser) return;
		dbGet<string>('meta', 'hw-trips-sync-pending').then((raw) => {
			const pending = new Set((raw || '').split(',').filter(Boolean));
			pending.add(tripId);
			dbPut('meta', 'hw-trips-sync-pending', [...pending].join(',')).catch(() => {});
		});
	}

	function clearSyncPending(tripId: string) {
		if (!isBrowser) return;
		dbGet<string>('meta', 'hw-trips-sync-pending').then((raw) => {
			const pending = new Set((raw || '').split(',').filter(Boolean));
			pending.delete(tripId);
			const next = [...pending].join(',');
			if (next) {
				dbPut('meta', 'hw-trips-sync-pending', next).catch(() => {});
			} else {
				dbDelete('meta', 'hw-trips-sync-pending').catch(() => {});
			}
		});
	}

	async function discoverServerTrips() {
		try {
			const { fetchTripList } = await import('$lib/services/trips-api');
			const catalog = await fetchTripList();
			const local = get({ subscribe });
			for (const entry of catalog) {
				if (!local[entry.tripId]) {
					await pullFromServer(entry.tripId);
				}
			}
		} catch {
			// offline
		}
	}

	async function initSync(tripId: string) {
		const raw = await dbGet<string>('meta', 'hw-trips-sync-pending');
		if (raw && raw.split(',').includes(tripId)) {
			await pushToServer(tripId);
		}
		await pullFromServer(tripId);
	}

	function flushPendingSyncs() {
		if (!isBrowser) return;
		dbGet<string>('meta', 'hw-trips-sync-pending').then((raw) => {
			if (!raw) return;
			const pending = raw.split(',').filter(Boolean);
			for (const tripId of pending) {
				scheduleSyncToServer(tripId);
			}
		});
	}

	// Listen for online recovery
	if (isBrowser) {
		window.addEventListener('online', () => flushPendingSyncs());
	}

	return {
		subscribe,

		async init() {
			// Load from IndexedDB
			const rows = await dbGetAll<Trip>('trips');
			let trips: Record<string, Trip>;
			if (rows.length === 0) {
				trips = normalizeTrips(cloneDefaults());
			} else {
				const fromDb: Record<string, Trip> = {};
				for (const row of rows) {
					fromDb[row.key] = row.value;
				}
				trips = normalizeTrips({ ...cloneDefaults(), ...fromDb });
			}
			set(trips);

			// Sync known trips
			for (const tripId of Object.keys(trips)) {
				initSync(tripId);
			}
			// Discover new trips from server
			discoverServerTrips();
		},

		getTrip(id: string): Trip | undefined {
			return get({ subscribe })[id];
		},

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

		updateDayField(id: string, dayIndex: number, field: keyof TripDay, value: string | boolean) {
			update((trips) => {
				const trip = trips[id];
				if (!trip || !trip.days[dayIndex]) return trips;
				snapshot(trips);
				(trip.days[dayIndex] as unknown as Record<string, unknown>)[field] = value;

				if (field === 'date' && typeof value === 'string') {
					const d = new Date(value + 'T12:00:00');
					if (!isNaN(d.getTime())) {
						trip.days[dayIndex].dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
					}
				}

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

				const dates = trip.days.map((d) => d.date).filter(Boolean).sort();
				if (dates.length) {
					trip.startDate = dates[0];
					trip.endDate = dates[dates.length - 1];
				}

				persistAndSync(trips, id);
				return { ...trips };
			});
		},

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
			for (const tripId of Object.keys(trips)) {
				const now = new Date().toISOString();
				saveMetaField(tripId, now);
				scheduleSyncToServer(tripId);
			}
		},

		canUndo(): boolean {
			return undoStack.length > 0;
		},

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

		exportTrip(id: string): string {
			const trips = get({ subscribe });
			const trip = trips[id];
			if (!trip) return '';
			return JSON.stringify(trip, null, 2);
		},

		async removeTrip(id: string): Promise<boolean> {
			const current = get({ subscribe });
			if (!current[id]) return false;
			update((trips) => {
				snapshot(trips);
				delete trips[id];
				saveTrips(trips);
				return { ...trips };
			});
			// Clean up IndexedDB metadata
			if (isBrowser) {
				const meta = await loadMeta();
				delete meta[id];
				await dbPut('meta', 'hw-trips-meta', meta);
				clearSyncPending(id);
				await dbDelete('prefs', `hw-trip-day-${id}`);
				await dbDelete('trips', id);
			}
			try {
				const { deleteTrip } = await import('$lib/services/trips-api');
				await deleteTrip(id);
			} catch {
				// Server delete failed — trip is already removed locally
			}
			return true;
		},

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
