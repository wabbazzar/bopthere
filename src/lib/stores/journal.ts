import { writable, get } from 'svelte/store';
import type {
	JournalEntry,
	TripDay,
	ItineraryCheckItem,
	JournalBlock,
	JournalTextBlock,
	JournalPhotoBlock
} from '$lib/types/trip';
import { migrateEntry, stripTransientFields } from '$lib/utils/journal-migration';

type JournalByTrip = Record<string, JournalEntry[]>;

const JOURNAL_KEY_PREFIX = 'hw-journal-';
const META_KEY = 'hw-journal-meta';
const SYNC_DEBOUNCE_MS = 2000;

const ITINERARY_SLOTS = ['travel', 'morning', 'afternoon', 'evening'] as const;

function migrateAll(entries: unknown[]): JournalEntry[] {
	return entries.map((e) => migrateEntry(e as Record<string, unknown>));
}

function loadLocal(tripId: string): JournalEntry[] {
	if (typeof localStorage === 'undefined') return [];
	const raw = localStorage.getItem(JOURNAL_KEY_PREFIX + tripId);
	if (!raw) return [];
	try {
		return migrateAll(JSON.parse(raw));
	} catch {
		return [];
	}
}

function saveLocal(tripId: string, entries: JournalEntry[]) {
	if (typeof localStorage === 'undefined') return;
	// Strip transient fields before persisting
	const cleaned = entries.map((e) => ({
		...e,
		blocks: stripTransientFields(e.blocks)
	}));
	localStorage.setItem(JOURNAL_KEY_PREFIX + tripId, JSON.stringify(cleaned));
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
			// Strip transient fields before sending to server
			const cleaned = entries.map((e) => ({
				...e,
				blocks: stripTransientFields(e.blocks)
			}));
			const meta = loadMeta();
			const updatedAt = meta[tripId] || new Date().toISOString();
			const result = await saveJournal(tripId, cleaned, updatedAt);
			if (result.ok) {
				setMeta(tripId, result.updatedAt);
			} else if (result.serverJournal) {
				const migrated = migrateAll(result.serverJournal);
				update((state) => ({ ...state, [tripId]: migrated }));
				saveLocal(tripId, migrated);
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
				const migrated = migrateAll(result.journal);
				update((state) => ({ ...state, [tripId]: migrated }));
				saveLocal(tripId, migrated);
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
				blocks: [{ id: crypto.randomUUID(), type: 'text', content: '' }],
				itinerary: deriveItinerary(day),
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

		// ── Block mutations ───────────────────────────────────────

		updateBlockContent(tripId: string, dayIndex: number, blockId: string, content: string) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				blocks: e.blocks.map((b) =>
					b.id === blockId && b.type === 'text' ? { ...b, content } : b
				),
				updatedAt: new Date().toISOString()
			}));
		},

		updatePhotoCaption(tripId: string, dayIndex: number, blockId: string, caption: string) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				blocks: e.blocks.map((b) =>
					b.id === blockId && b.type === 'photo' ? { ...b, caption } : b
				),
				updatedAt: new Date().toISOString()
			}));
		},

		/** Insert a block after the block with the given id. If afterBlockId is null, append. */
		insertBlock(tripId: string, dayIndex: number, afterBlockId: string | null, block: JournalBlock) {
			updateEntry(tripId, dayIndex, (e) => {
				const blocks = [...e.blocks];
				if (afterBlockId === null) {
					blocks.push(block);
				} else {
					const idx = blocks.findIndex((b) => b.id === afterBlockId);
					if (idx !== -1) {
						blocks.splice(idx + 1, 0, block);
					} else {
						blocks.push(block);
					}
				}
				return { ...e, blocks, updatedAt: new Date().toISOString() };
			});
		},

		/** Remove a block. If a photo block is removed between two text blocks, merge them. */
		removeBlock(tripId: string, dayIndex: number, blockId: string) {
			updateEntry(tripId, dayIndex, (e) => {
				const idx = e.blocks.findIndex((b) => b.id === blockId);
				if (idx === -1) return e;
				const blocks = [...e.blocks];
				blocks.splice(idx, 1);

				// Merge adjacent text blocks
				for (let i = blocks.length - 1; i > 0; i--) {
					if (blocks[i].type === 'text' && blocks[i - 1].type === 'text') {
						const prev = blocks[i - 1] as JournalTextBlock;
						const curr = blocks[i] as JournalTextBlock;
						blocks[i - 1] = {
							...prev,
							content: prev.content + (prev.content && curr.content ? '\n' : '') + curr.content
						};
						blocks.splice(i, 1);
					}
				}

				// Ensure at least one text block
				if (blocks.length === 0) {
					blocks.push({ id: crypto.randomUUID(), type: 'text', content: '' });
				}

				return { ...e, blocks, updatedAt: new Date().toISOString() };
			});
		},

		/** Split a text block at cursor position and insert a photo block between the halves. */
		splitAndInsertPhoto(
			tripId: string,
			dayIndex: number,
			textBlockId: string,
			cursorPos: number,
			photoBlock: JournalPhotoBlock
		) {
			updateEntry(tripId, dayIndex, (e) => {
				const idx = e.blocks.findIndex((b) => b.id === textBlockId);
				if (idx === -1 || e.blocks[idx].type !== 'text') return e;

				const textBlock = e.blocks[idx] as JournalTextBlock;
				const before = textBlock.content.slice(0, cursorPos);
				const after = textBlock.content.slice(cursorPos);

				const blocks = [...e.blocks];
				blocks.splice(
					idx,
					1,
					{ id: textBlock.id, type: 'text', content: before },
					photoBlock,
					{ id: crypto.randomUUID(), type: 'text', content: after }
				);

				return { ...e, blocks, updatedAt: new Date().toISOString() };
			});
		},

		/** Update a photo block's photoId (after upload completes). */
		updatePhotoId(tripId: string, dayIndex: number, blockId: string, photoId: string) {
			updateEntry(tripId, dayIndex, (e) => ({
				...e,
				blocks: e.blocks.map((b) =>
					b.id === blockId && b.type === 'photo'
						? { ...b, photoId, _localObjectUrl: undefined, _uploadPending: undefined }
						: b
				),
				updatedAt: new Date().toISOString()
			}));
		},

		// ── Itinerary & metadata (unchanged) ──────────────────────

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
