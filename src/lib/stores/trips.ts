import { writable, get } from 'svelte/store';
import type { Trip, TripDay, MapLink } from '$lib/types/trip';
import { chinaTrip } from '$lib/data/china-2026';

const STORAGE_KEY = 'hw-trips';
const UNDO_LIMIT = 50;

// Default trips keyed by id — deep frozen copy so mutations never leak back
const defaults: Record<string, Trip> = JSON.parse(JSON.stringify({
	'china-2026': chinaTrip
}));

/** Deep-clone defaults so store mutations never corrupt the originals */
function cloneDefaults(): Record<string, Trip> {
	return JSON.parse(JSON.stringify(defaults));
}

function loadTrips(): Record<string, Trip> {
	if (typeof localStorage === 'undefined') return cloneDefaults();
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return cloneDefaults();
	try {
		const saved = JSON.parse(raw) as Record<string, Trip>;
		// Merge: saved data wins, but include any new default trips
		return { ...cloneDefaults(), ...saved };
	} catch {
		return cloneDefaults();
	}
}

function saveTrips(trips: Record<string, Trip>) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

function createTripsStore() {
	const { subscribe, set, update } = writable<Record<string, Trip>>(loadTrips());
	const undoStack: string[] = [];

	function snapshot(trips: Record<string, Trip>) {
		undoStack.push(JSON.stringify(trips));
		if (undoStack.length > UNDO_LIMIT) undoStack.shift();
	}

	function persist() {
		saveTrips(get({ subscribe }));
	}

	return {
		subscribe,

		init() {
			set(loadTrips());
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
				// Recalculate destinations from days
				if (field === 'name' || field === 'startDate' || field === 'endDate') {
					// no-op, just save
				}
				saveTrips(trips);
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
				saveTrips(trips);
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
				const locs = [...new Set(trip.days.map((d) => d.location).filter(Boolean))];
				trip.destinations = locs;

				saveTrips(trips);
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

				saveTrips(trips);
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
				const locs = [...new Set(trip.days.map((d) => d.location).filter(Boolean))];
				trip.destinations = locs;

				saveTrips(trips);
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
				saveTrips(trips);
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
				// Increment date by 1
				if (copy.date) {
					const d = new Date(copy.date + 'T12:00:00');
					d.setDate(d.getDate() + 1);
					copy.date = d.toISOString().split('T')[0];
					copy.dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
				}
				trip.days.splice(dayIndex + 1, 0, copy);
				saveTrips(trips);
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
				saveTrips(trips);
				return { ...trips };
			});
		},

		updateLink(id: string, linkIndex: number, url: string) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links[linkIndex] = url;
				saveTrips(trips);
				return { ...trips };
			});
		},

		deleteLink(id: string, linkIndex: number) {
			update((trips) => {
				const trip = trips[id];
				if (!trip) return trips;
				snapshot(trips);
				trip.links.splice(linkIndex, 1);
				saveTrips(trips);
				return { ...trips };
			});
		},

		// Undo
		setDayMapLinks(id: string, dayIndex: number, mapLinks: MapLink[]) {
			update((trips) => {
				const trip = trips[id];
				if (!trip || !trip.days[dayIndex]) return trips;
				snapshot(trips);
				trip.days[dayIndex].mapLinks = mapLinks;
				saveTrips(trips);
				return { ...trips };
			});
		},

		undo() {
			const prev = undoStack.pop();
			if (!prev) return;
			const trips = JSON.parse(prev);
			set(trips);
			saveTrips(trips);
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
					saveTrips(trips);
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
		}
	};
}

export const trips = createTripsStore();
