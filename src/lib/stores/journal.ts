import { writable, get } from 'svelte/store';
import type { JournalEntry, TripDay, ItineraryCheckItem, JournalPhoto } from '$lib/types/trip';

type JournalByTrip = Record<string, JournalEntry[]>;

const JOURNAL_KEY_PREFIX = 'hw-journal-';
const META_KEY = 'hw-journal-meta';
const SYNC_DEBOUNCE_MS = 2000;

const ITINERARY_SLOTS = ['travel', 'morning', 'afternoon', 'evening'] as const;

function loadLocal(tripId: string): JournalEntry[] {
	if (typeof localStorage === 'undefined') return [];
	const raw = localStorage.getItem(JOURNAL_KEY_PREFIX + tripId);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as JournalEntry[];
	} catch {
		return [];
	}
}

function saveLocal(tripId: string, entries: JournalEntry[]) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(JOURNAL_KEY_PREFIX + tripId, JSON.stringify(entries));
}

function loadMeta(): Record<string, string> {
	if (typeof localStorage === 'undefined') return {};
	try {
		return JSON.parse(localStorage.getItem(META_KEY) || '{}');
	} catch {
		return {};
	}
}

function setMeta(tripId: string, ts: string) {
	if (typeof localStorage === 'undefined') return;
	const m = loadMeta();
	m[tripId] = ts;
	localStorage.setItem(META_KEY, JSON.stringify(m));
}

/** Snapshot non-empty planning fields into checklist items. */
function deriveItinerary(day: TripDay): ItineraryCheckItem[] {
	const items: ItineraryCheckItem[] = [];
	for (const slot of ITINERARY_SLOTS) {
		const text = day[slot];
		if (text && text.trim()) {
			items.push({ slot, text: text.trim(), done: false });
		}
	}
	return items;
}

function createJournalStore() {
	const { subscribe, update } = writable<JournalByTrip>({});
	const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

	function getEntries(tripId: string): JournalEntry[] {
		return get({ subscribe })[tripId] ?? [];
	}

	function persistAndSync(tripId: string, next: JournalEntry[]) {
		saveLocal(tripId, next);
		setMeta(tripId, new Date().toISOString());
		scheduleSync(tripId);
	}

	function scheduleSync(tripId: string) {
		const existing = syncTimers.get(tripId);
		if (existing) clearTimeout(existing);
		syncTimers.set(
			tripId,
			setTimeout(() => {
				syncTimers.delete(tripId);
				pushToServer(tripId);
			}, SYNC_DEBOUNCE_MS)
		);
	}

	async function pushToServer(tripId: string) {
		try {
			const { saveJournal } = await import('$lib/services/trips-api');
			const entries = getEntries(tripId);
			const meta = loadMeta();
			const updatedAt = meta[tripId] || new Date().toISOString();
			const result = await saveJournal(tripId, entries, updatedAt);
			if (result.ok) {
				setMeta(tripId, result.updatedAt);
			} else if (result.serverJournal) {
				update((state) => ({ ...state, [tripId]: result.serverJournal! }));
				saveLocal(tripId, result.serverJournal!);
				setMeta(tripId, result.updatedAt);
			}
		} catch {
			// offline — localStorage has latest, will retry on next save
		}
	}

	async function pullFromServer(tripId: string) {
		try {
			const { fetchJournal, saveJournal } = await import('$lib/services/trips-api');
			const result = await fetchJournal(tripId);
			const meta = loadMeta();
			const localTs = meta[tripId] || '';
			if (result.updatedAt === null) {
				if (localTs) {
					const entries = getEntries(tripId);
					const saveResult = await saveJournal(tripId, entries, localTs);
					if (saveResult.ok) setMeta(tripId, saveResult.updatedAt);
				}
			} else if (!localTs || result.updatedAt > localTs) {
				update((state) => ({ ...state, [tripId]: result.journal }));
				saveLocal(tripId, result.journal);
				setMeta(tripId, result.updatedAt);
			}
		} catch {
			// offline
		}
	}

	function updateEntry(
		tripId: string,
		dayIndex: number,
		updater: (entry: JournalEntry) => JournalEntry
	) {
		update((state) => {
			const entries = state[tripId] ?? [];
			const idx = entries.findIndex((e) => e.dayIndex === dayIndex);
			if (idx === -1) return state;
			const next = [...entries];
			next[idx] = updater({ ...next[idx] });
			persistAndSync(tripId, next);
			return { ...state, [tripId]: next };
		});
	}

	return {
		subscribe,

		init(tripId: string) {
			const local = loadLocal(tripId);
			update((state) => ({ ...state, [tripId]: local }));
			pullFromServer(tripId);
		},

		getEntry(tripId: string, dayIndex: number): JournalEntry | undefined {
			return getEntries(tripId).find((e) => e.dayIndex === dayIndex);
		},

		hasEntry(tripId: string, dayIndex: number): boolean {
			return getEntries(tripId).some((e) => e.dayIndex === dayIndex);
		},

		/** Create a new entry (snapshotting itinerary) or return existing. */
		createOrHydrate(tripId: string, dayIndex: number, day: TripDay): JournalEntry {
			const existing = getEntries(tripId).find((e) => e.dayIndex === dayIndex);
			if (existing) return existing;

			const now = new Date().toISOString();
			const entry: JournalEntry = {
				dayIndex,
				date: day.date,
				location: day.location,
				body: '',
				itinerary: deriveItinerary(day),
				photos: [],
				createdAt: now,
				updatedAt: now
			};

			update((state) => {
				const next = [...(state[tripId] ?? []), entry];
				persistAndSync(tripId, next);
				return { ...state, [tripId]: next };
			});

			return entry;
		},

		updateBody(tripId: string, dayIndex: number, body: string) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				body,
				updatedAt: new Date().toISOString()
			}));
		},

		toggleItineraryItem(tripId: string, dayIndex: number, itemIndex: number) {
			updateEntry(tripId, dayIndex, (e) => {
				const itinerary = [...e.itinerary];
				if (itemIndex >= 0 && itemIndex < itinerary.length) {
					itinerary[itemIndex] = { ...itinerary[itemIndex], done: !itinerary[itemIndex].done };
				}
				return { ...e, itinerary, updatedAt: new Date().toISOString() };
			});
		},

		updateItineraryNotes(tripId: string, dayIndex: number, itemIndex: number, notes: string) {
			updateEntry(tripId, dayIndex, (e) => {
				const itinerary = [...e.itinerary];
				if (itemIndex >= 0 && itemIndex < itinerary.length) {
					itinerary[itemIndex] = { ...itinerary[itemIndex], notes: notes || undefined };
				}
				return { ...e, itinerary, updatedAt: new Date().toISOString() };
			});
		},

		setMood(tripId: string, dayIndex: number, mood: JournalEntry['mood']) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				mood,
				updatedAt: new Date().toISOString()
			}));
		},

		setWeather(tripId: string, dayIndex: number, weather: string) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				weather: weather || undefined,
				updatedAt: new Date().toISOString()
			}));
		},

		addPhoto(tripId: string, dayIndex: number, photo: JournalPhoto) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				photos: [...e.photos, photo],
				updatedAt: new Date().toISOString()
			}));
		},

		removePhoto(tripId: string, dayIndex: number, photoId: string) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				photos: e.photos.filter((p) => p.id !== photoId),
				updatedAt: new Date().toISOString()
			}));
		},

		updatePhotoCaption(tripId: string, dayIndex: number, photoId: string, caption: string) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				photos: e.photos.map((p) => (p.id === photoId ? { ...p, caption } : p)),
				updatedAt: new Date().toISOString()
			}));
		},

		deleteEntry(tripId: string, dayIndex: number) {
			update((state) => {
				const entries = state[tripId] ?? [];
				const next = entries.filter((e) => e.dayIndex !== dayIndex);
				persistAndSync(tripId, next);
				return { ...state, [tripId]: next };
			});
		}
	};
}

export const journalStore = createJournalStore();
