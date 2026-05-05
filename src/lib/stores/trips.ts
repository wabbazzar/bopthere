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

/** Extract metadata fields from a Trip (everything except days) */
function extractMeta(trip: Trip): Record<string, unknown> {
	return {
		name: trip.name,
		startDate: trip.startDate,
		endDate: trip.endDate,
		destinations: trip.destinations,
		links: trip.links
	};
}

/** Apply metadata fields to a Trip object */
function applyMeta(trip: Trip, meta: Record<string, unknown>): void {
	if (meta.name !== undefined) trip.name = meta.name as string;
	if (meta.startDate !== undefined) trip.startDate = meta.startDate as string;
	if (meta.endDate !== undefined) trip.endDate = meta.endDate as string;
	if (meta.destinations !== undefined) trip.destinations = meta.destinations as string[];
	if (meta.links !== undefined) trip.links = meta.links as string[];
}

function createTripsStore() {
	// Start with defaults — init() will hydrate from IndexedDB + server
	const { subscribe, set, update } = writable<Record<string, Trip>>(normalizeTrips(cloneDefaults()));
	const undoStack: string[] = [];

	// Debounce timers keyed by "day:{tripId}:{dayIndex}" or "meta:{tripId}"
	const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

	// Track meta versions per trip (from server)
	const metaVersions = new Map<string, number>();

	function snapshot(trips: Record<string, Trip>) {
		undoStack.push(JSON.stringify(trips));
		if (undoStack.length > UNDO_LIMIT) undoStack.shift();
	}

	// ── IndexedDB persistence ──────────────────────────────────

	/** Save a single day to IndexedDB */
	function saveDayToDb(tripId: string, dayIndex: number, day: TripDay) {
		if (!isBrowser) return;
		dbPut('trips', `trip-day:${tripId}:${dayIndex}`, day).catch(() => {});
	}

	/** Save trip metadata to IndexedDB */
	function saveMetaToDb(tripId: string, meta: Record<string, unknown>) {
		if (!isBrowser) return;
		dbPut('trips', `trip-meta:${tripId}`, meta).catch(() => {});
	}

	/** Save all days for a trip to IndexedDB */
	function saveAllDaysToDb(tripId: string, days: TripDay[]) {
		if (!isBrowser) return;
		for (let i = 0; i < days.length; i++) {
			saveDayToDb(tripId, i, days[i]);
		}
	}

	/** Delete all per-day keys for a trip from IndexedDB beyond a given count */
	async function trimDayKeysInDb(tripId: string, newCount: number) {
		if (!isBrowser) return;
		// Get all keys and delete anything beyond newCount
		const rows = await dbGetAll<TripDay>('trips');
		const prefix = `trip-day:${tripId}:`;
		for (const row of rows) {
			if (row.key.startsWith(prefix)) {
				const idx = parseInt(row.key.slice(prefix.length), 10);
				if (idx >= newCount) {
					dbDelete('trips', row.key).catch(() => {});
				}
			}
		}
	}

	/** Persist changed day + meta after a day mutation */
	function persistDay(tripId: string, dayIndex: number, trips: Record<string, Trip>) {
		const trip = trips[tripId];
		if (!trip) return;
		saveDayToDb(tripId, dayIndex, trip.days[dayIndex]);
		saveMetaToDb(tripId, extractMeta(trip));
		scheduleDaySync(tripId, dayIndex);
	}

	/** Persist all days + meta (for structural changes like add/delete/move/duplicate) */
	function persistAllDays(tripId: string, trips: Record<string, Trip>) {
		const trip = trips[tripId];
		if (!trip) return;
		saveAllDaysToDb(tripId, trip.days);
		saveMetaToDb(tripId, extractMeta(trip));
	}

	/** Persist only metadata */
	function persistMeta(tripId: string, trips: Record<string, Trip>) {
		const trip = trips[tripId];
		if (!trip) return;
		saveMetaToDb(tripId, extractMeta(trip));
		scheduleMetaSync(tripId);
	}

	// ── Server sync ────────────────────────────────────────────

	function scheduleDaySync(tripId: string, dayIndex: number) {
		const key = `day:${tripId}:${dayIndex}`;
		const existing = syncTimers.get(key);
		if (existing) clearTimeout(existing);
		syncTimers.set(key, setTimeout(() => {
			syncTimers.delete(key);
			pushDayToServer(tripId, dayIndex);
		}, SYNC_DEBOUNCE_MS));
	}

	function scheduleMetaSync(tripId: string) {
		const key = `meta:${tripId}`;
		const existing = syncTimers.get(key);
		if (existing) clearTimeout(existing);
		syncTimers.set(key, setTimeout(() => {
			syncTimers.delete(key);
			pushMetaToServer(tripId);
		}, SYNC_DEBOUNCE_MS));
	}

	/** Push a single day to the server. On 409 (stale), accept server version. */
	async function pushDayToServer(tripId: string, dayIndex: number) {
		try {
			const { saveTripDay } = await import('$lib/services/trips-api');
			const trips = get({ subscribe });
			const trip = trips[tripId];
			if (!trip || !trip.days[dayIndex]) return;
			const day = trip.days[dayIndex];
			const result = await saveTripDay(tripId, dayIndex, day, day.version ?? null);
			if (result.ok) {
				// Update version in-memory
				update((t) => {
					if (t[tripId]?.days[dayIndex]) {
						t[tripId].days[dayIndex].version = result.version;
						saveDayToDb(tripId, dayIndex, t[tripId].days[dayIndex]);
					}
					return t;
				});
				clearSyncPending(`day:${tripId}:${dayIndex}`);
			} else if (result.serverDay) {
				// Server wins on conflict
				update((t) => {
					if (t[tripId]?.days[dayIndex]) {
						const serverDay = { ...result.serverDay!, version: result.version };
						t[tripId].days[dayIndex] = serverDay;
						saveDayToDb(tripId, dayIndex, serverDay);
					}
					return { ...t };
				});
				clearSyncPending(`day:${tripId}:${dayIndex}`);
			}
		} catch {
			markSyncPending(`day:${tripId}:${dayIndex}`);
		}
	}

	/** Push trip metadata to the server */
	async function pushMetaToServer(tripId: string) {
		try {
			const { saveTripMeta } = await import('$lib/services/trips-api');
			const trips = get({ subscribe });
			const trip = trips[tripId];
			if (!trip) return;
			const meta = extractMeta(trip);
			const version = metaVersions.get(tripId) ?? null;
			const result = await saveTripMeta(tripId, meta, version);
			if (result.ok) {
				metaVersions.set(tripId, result.version);
				clearSyncPending(`meta:${tripId}`);
			} else if (result.serverMeta) {
				// Server wins
				update((t) => {
					if (t[tripId]) {
						applyMeta(t[tripId], result.serverMeta!);
						saveMetaToDb(tripId, result.serverMeta!);
					}
					return { ...t };
				});
				metaVersions.set(tripId, result.version);
				clearSyncPending(`meta:${tripId}`);
			}
		} catch {
			markSyncPending(`meta:${tripId}`);
		}
	}

	/** Push all days + meta to server (for addTrip / structural changes) */
	async function pushAllToServer(tripId: string) {
		const trips = get({ subscribe });
		const trip = trips[tripId];
		if (!trip) return;

		// Push meta
		pushMetaToServer(tripId);

		// Push each day
		for (let i = 0; i < trip.days.length; i++) {
			pushDayToServer(tripId, i);
		}
	}

	/** Pull server state on init. Server is authoritative for per-entry data. */
	async function pullFromServer(tripId: string) {
		try {
			const { fetchTripDays, fetchTripMeta, fetchTrip, saveTrip } = await import('$lib/services/trips-api');

			// Try per-entry endpoints first
			let gotPerEntry = false;
			try {
				const [daysResult, metaResult] = await Promise.all([
					fetchTripDays(tripId),
					fetchTripMeta(tripId)
				]);

				if (daysResult.days.length > 0 || metaResult !== null) {
					gotPerEntry = true;
					update((trips) => {
						const trip = trips[tripId];
						if (!trip) return trips;

						// Apply days from server
						if (daysResult.days.length > 0) {
							trip.days = daysResult.days.map((d) => {
								const { _version, ...dayFields } = d;
								return { ...dayFields, version: _version } as TripDay;
							});
							saveAllDaysToDb(tripId, trip.days);
						}

						// Apply meta from server
						if (metaResult !== null) {
							applyMeta(trip, metaResult.meta);
							metaVersions.set(tripId, metaResult.version);
							saveMetaToDb(tripId, metaResult.meta);
						}

						trip.destinations = computeDestinations(trip.days);

						const dates = trip.days.map((d) => d.date).filter(Boolean).sort();
						if (dates.length) {
							trip.startDate = dates[0];
							trip.endDate = dates[dates.length - 1];
						}

						return { ...trips };
					});
				}
			} catch {
				// Per-entry endpoints not available yet, fall through to blob
			}

			if (!gotPerEntry) {
				// Fall back to blob endpoint for backward compat
				const serverResult = await fetchTrip(tripId);
				if (serverResult === null) {
					// Server has no data — push local state
					const trips = get({ subscribe });
					const trip = trips[tripId];
					if (trip) {
						const now = new Date().toISOString();
						await saveTrip(tripId, trip, now);
						// Also push per-entry
						pushAllToServer(tripId);
					}
				} else {
					update((trips) => {
						trips[tripId] = normalizeTrips({ [tripId]: serverResult.trip })[tripId];
						persistAllDays(tripId, trips);
						return { ...trips };
					});
					// Seed per-entry endpoints from blob data
					pushAllToServer(tripId);
				}
			}
		} catch {
			// Offline — use IndexedDB as-is
		}
	}

	function markSyncPending(syncKey: string) {
		if (!isBrowser) return;
		dbGet<string>('meta', 'hw-trips-sync-pending').then((raw) => {
			const pending = new Set((raw || '').split(',').filter(Boolean));
			pending.add(syncKey);
			dbPut('meta', 'hw-trips-sync-pending', [...pending].join(',')).catch(() => {});
		});
	}

	function clearSyncPending(syncKey: string) {
		if (!isBrowser) return;
		dbGet<string>('meta', 'hw-trips-sync-pending').then((raw) => {
			const pending = new Set((raw || '').split(',').filter(Boolean));
			pending.delete(syncKey);
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
					// Create a shell so pullFromServer can populate it
					update((trips) => {
						trips[entry.tripId] = {
							id: entry.tripId,
							name: '',
							startDate: '',
							endDate: '',
							destinations: [],
							days: [],
							links: []
						} as Trip;
						return { ...trips };
					});
					await pullFromServer(entry.tripId);
				}
			}
		} catch {
			// offline
		}
	}

	async function initSync(tripId: string) {
		// Flush any pending syncs first
		const raw = await dbGet<string>('meta', 'hw-trips-sync-pending');
		if (raw) {
			const pending = raw.split(',').filter(Boolean);
			for (const syncKey of pending) {
				if (syncKey.startsWith(`day:${tripId}:`)) {
					const dayIndex = parseInt(syncKey.split(':')[2], 10);
					if (!isNaN(dayIndex)) {
						await pushDayToServer(tripId, dayIndex);
					}
				} else if (syncKey === `meta:${tripId}`) {
					await pushMetaToServer(tripId);
				}
			}
		}
		await pullFromServer(tripId);
	}

	function flushPendingSyncs() {
		if (!isBrowser) return;
		dbGet<string>('meta', 'hw-trips-sync-pending').then((raw) => {
			if (!raw) return;
			const pending = raw.split(',').filter(Boolean);
			for (const syncKey of pending) {
				if (syncKey.startsWith('day:')) {
					const parts = syncKey.split(':');
					const tripId = parts[1];
					const dayIndex = parseInt(parts[2], 10);
					if (!isNaN(dayIndex)) {
						scheduleDaySync(tripId, dayIndex);
					}
				} else if (syncKey.startsWith('meta:')) {
					const tripId = syncKey.slice(5);
					scheduleMetaSync(tripId);
				}
			}
		});
	}

	// Listen for online recovery
	if (isBrowser) {
		window.addEventListener('online', () => flushPendingSyncs());
	}

	/** Load trips from IndexedDB, supporting both per-day and legacy blob keys */
	async function loadFromDb(): Promise<Record<string, Trip>> {
		const rows = await dbGetAll<unknown>('trips');
		if (rows.length === 0) return {};

		const fromDb: Record<string, Trip> = {};
		const perDayData = new Map<string, Map<number, TripDay>>();
		const metaData = new Map<string, Record<string, unknown>>();

		for (const row of rows) {
			if (row.key.startsWith('trip-day:')) {
				// Per-day key: trip-day:{tripId}:{dayIndex}
				const parts = row.key.split(':');
				const tripId = parts[1];
				const dayIndex = parseInt(parts[2], 10);
				if (!perDayData.has(tripId)) perDayData.set(tripId, new Map());
				perDayData.get(tripId)!.set(dayIndex, row.value as TripDay);
			} else if (row.key.startsWith('trip-meta:')) {
				// Per-meta key: trip-meta:{tripId}
				const tripId = row.key.slice(10);
				metaData.set(tripId, row.value as Record<string, unknown>);
			} else {
				// Legacy blob key (tripId -> full Trip object)
				fromDb[row.key] = row.value as Trip;
			}
		}

		// Reconstruct trips from per-day + per-meta data
		const allTripIds = new Set([...perDayData.keys(), ...metaData.keys()]);
		for (const tripId of allTripIds) {
			const dayMap = perDayData.get(tripId);
			const meta = metaData.get(tripId);

			if (dayMap && dayMap.size > 0) {
				// Build days array from indexed entries
				const maxIdx = Math.max(...dayMap.keys());
				const days: TripDay[] = [];
				for (let i = 0; i <= maxIdx; i++) {
					days.push(dayMap.get(i) ?? {
						date: '', dayOfWeek: '', location: '', travel: '',
						morning: '', afternoon: '', evening: '',
						accommodation: '', notes: '', ooo: false
					});
				}

				// Start from existing (legacy blob or defaults) or create from scratch
				const base = fromDb[tripId] ?? defaults[tripId];
				const trip: Trip = base
					? { ...JSON.parse(JSON.stringify(base)), days }
					: { id: tripId, name: '', startDate: '', endDate: '', destinations: [], days, links: [] };

				if (meta) applyMeta(trip, meta);
				trip.destinations = computeDestinations(trip.days);
				fromDb[tripId] = trip;
			}
		}

		return fromDb;
	}

	return {
		subscribe,

		async init() {
			// Load from IndexedDB (supports both per-day and legacy blob keys)
			const fromDb = await loadFromDb();
			let trips: Record<string, Trip>;
			if (Object.keys(fromDb).length === 0) {
				trips = normalizeTrips(cloneDefaults());
			} else {
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
				persistMeta(id, trips);
				return { ...trips };
			});
		},

		updateDestinations(id: string, destinations: string[]) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.destinations = destinations;
				persistMeta(id, trips);
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

				// Persist the specific day + updated meta
				persistDay(id, dayIndex, trips);
				// Also sync meta if dates/destinations changed
				if (field === 'date' || field === 'location') {
					scheduleMetaSync(id);
				}
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

				// Structural change: save all days from the insertion point onward
				persistAllDays(id, trips);
				// Push all affected days (idx and beyond shifted)
				for (let i = idx; i < trip.days.length; i++) {
					scheduleDaySync(id, i);
				}
				scheduleMetaSync(id);
				return { ...trips };
			});
		},

		deleteDay(id: string, dayIndex: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip || trip.days.length <= 1) return trips;
				snapshot(trips);

				const deletedDay = trip.days[dayIndex];
				const deletedVersion = deletedDay.version;
				trip.days.splice(dayIndex, 1);

				const dates = trip.days.map((d) => d.date).filter(Boolean).sort();
				if (dates.length) {
					trip.startDate = dates[0];
					trip.endDate = dates[dates.length - 1];
				}
				trip.destinations = computeDestinations(trip.days);

				// Structural change: resave all days, trim extra keys
				persistAllDays(id, trips);
				trimDayKeysInDb(id, trip.days.length);

				// Delete from server, then re-push shifted days
				(async () => {
					try {
						const { deleteTripDay } = await import('$lib/services/trips-api');
						if (deletedVersion !== undefined) {
							await deleteTripDay(id, dayIndex, deletedVersion);
						}
					} catch {
						// Best effort — next full pull will reconcile
					}
					// Re-push days that shifted
					for (let i = dayIndex; i < trip.days.length; i++) {
						scheduleDaySync(id, i);
					}
				})();
				scheduleMetaSync(id);
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

				// Both the old and new index changed
				persistAllDays(id, trips);
				scheduleDaySync(id, dayIndex);
				scheduleDaySync(id, newIndex);
				return { ...trips };
			});
		},

		duplicateDay(id: string, dayIndex: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				const copy: TripDay = { ...JSON.parse(JSON.stringify(trip.days[dayIndex])) };
				delete copy.version; // New day, no server version yet
				if (copy.date) {
					const d = new Date(copy.date + 'T12:00:00');
					d.setDate(d.getDate() + 1);
					copy.date = d.toISOString().split('T')[0];
					copy.dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
				}
				trip.days.splice(dayIndex + 1, 0, copy);

				// Structural change: save all days from insert point onward
				persistAllDays(id, trips);
				for (let i = dayIndex + 1; i < trip.days.length; i++) {
					scheduleDaySync(id, i);
				}
				return { ...trips };
			});
		},

		addLink(id: string, url: string) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links.push(url);
				persistMeta(id, trips);
				return { ...trips };
			});
		},

		updateLink(id: string, linkIndex: number, url: string) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links[linkIndex] = url;
				persistMeta(id, trips);
				return { ...trips };
			});
		},

		deleteLink(id: string, linkIndex: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links.splice(linkIndex, 1);
				persistMeta(id, trips);
				return { ...trips };
			});
		},

		setDayMapLinks(id: string, dayIndex: number, mapLinks: MapLink[]) {
			update((trips) => {
				const trip = trips[id];
				if (!trip || !trip.days[dayIndex]) return trips;
				snapshot(trips);
				trip.days[dayIndex].mapLinks = mapLinks;
				persistDay(id, dayIndex, trips);
				return { ...trips };
			});
		},

		undo() {
			const prev = undoStack.pop();
			if (!prev) return;
			const trips: Record<string, Trip> = JSON.parse(prev);
			set(trips);
			// Persist all days and meta for affected trips, then sync
			for (const tripId of Object.keys(trips)) {
				const trip = trips[tripId];
				if (!trip) continue;
				persistAllDays(tripId, trips);
				for (let i = 0; i < trip.days.length; i++) {
					scheduleDaySync(tripId, i);
				}
				scheduleMetaSync(tripId);
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
					persistAllDays(id, trips);
					// Sync all days + meta
					for (let i = 0; i < trips[id].days.length; i++) {
						scheduleDaySync(id, i);
					}
					scheduleMetaSync(id);
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
				return { ...trips };
			});
			// Clean up IndexedDB per-day and per-meta keys
			if (isBrowser) {
				const rows = await dbGetAll<unknown>('trips');
				const prefix = `trip-day:${id}:`;
				for (const row of rows) {
					if (row.key.startsWith(prefix) || row.key === `trip-meta:${id}`) {
						dbDelete('trips', row.key).catch(() => {});
					}
				}
				// Clean up legacy blob key too
				await dbDelete('trips', id);
				// Clean up other metadata
				clearSyncPending(`meta:${id}`);
				await dbDelete('prefs', `hw-trip-day-${id}`);
				metaVersions.delete(id);
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
				persistAllDays(trip.id, trips);
				// Push all days + meta to server
				pushAllToServer(trip.id);
				accepted = true;
				return { ...trips };
			});
			return accepted;
		}
	};
}

export const trips = createTripsStore();
