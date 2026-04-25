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
import { dbGet, dbPut, dbDelete, dbGetAll } from '$lib/stores/db';

type JournalByTrip = Record<string, JournalEntry[]>;

const ITINERARY_SLOTS = ['travel', 'morning', 'afternoon', 'evening'] as const;

function migrateAll(entries: unknown[]): JournalEntry[] {
	return entries.map((e) => migrateEntry(e as Record<string, unknown>));
}

/** Strip _version and _deleted metadata from server responses before storing in UI state. */
function cleanServerEntry(e: Record<string, unknown>): JournalEntry {
	const entry = migrateEntry(e);
	if ('_version' in e) entry.version = e._version as number;
	return entry;
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

/** IndexedDB key for a per-entry journal record. */
function idbKey(tripId: string, dayIndex: number): string {
	return `${tripId}:${dayIndex}`;
}

/** Prepare an entry for persistence — strip transient fields. */
function cleanForPersist(entry: JournalEntry): JournalEntry {
	return {
		...entry,
		blocks: stripTransientFields(entry.blocks)
	};
}

function createJournalStore() {
	const { subscribe, update } = writable<JournalByTrip>({});

	function getEntries(tripId: string): JournalEntry[] {
		return get({ subscribe })[tripId] ?? [];
	}

	/**
	 * Persist a SINGLE entry to IndexedDB and sync to server IMMEDIATELY.
	 * No debounce — journal data is Tier 1.
	 */
	function persistAndSyncEntry(tripId: string, entry: JournalEntry) {
		const cleaned = cleanForPersist(entry);
		// Write to IndexedDB (fire-and-forget — in-memory store is UI source of truth)
		dbPut('journal', idbKey(tripId, entry.dayIndex), cleaned).catch(() => {});
		// Sync this single entry to server immediately
		pushEntryToServer(tripId, entry.dayIndex).catch(() => {});
	}

	async function pushEntryToServer(tripId: string, dayIndex: number) {
		try {
			const { saveJournalEntry } = await import('$lib/services/trips-api');
			const entry = getEntries(tripId).find((e) => e.dayIndex === dayIndex);
			if (!entry) return;
			const cleaned = cleanForPersist(entry);
			// Strip version from the entry body (it's sent separately)
			const { version, ...entryBody } = cleaned;
			const result = await saveJournalEntry(tripId, dayIndex, entryBody as JournalEntry, version ?? null);
			if (result.ok) {
				// Update the version in the in-memory store
				update((state) => {
					const entries = state[tripId] ?? [];
					const idx = entries.findIndex((e) => e.dayIndex === dayIndex);
					if (idx !== -1) {
						const next = [...entries];
						next[idx] = { ...next[idx], version: result.version };
						// Also update IndexedDB with the new version
						dbPut('journal', idbKey(tripId, dayIndex), cleanForPersist(next[idx])).catch(() => {});
						return { ...state, [tripId]: next };
					}
					return state;
				});
			} else if (result.serverEntry) {
				// Server has newer data — accept it (conflict resolution)
				const serverEntry = cleanServerEntry(result.serverEntry as unknown as Record<string, unknown>);
				serverEntry.version = result.version;
				update((state) => {
					const entries = state[tripId] ?? [];
					const idx = entries.findIndex((e) => e.dayIndex === dayIndex);
					const next = [...entries];
					if (idx !== -1) {
						next[idx] = serverEntry;
					} else {
						next.push(serverEntry);
					}
					dbPut('journal', idbKey(tripId, dayIndex), cleanForPersist(serverEntry)).catch(() => {});
					return { ...state, [tripId]: next };
				});
			}
		} catch {
			// offline — IndexedDB has latest, will retry on next save
		}
	}

	async function pullFromServer(tripId: string) {
		try {
			const { fetchJournalEntries } = await import('$lib/services/trips-api');
			const result = await fetchJournalEntries(tripId);
			if (!result.entries.length) return;

			const serverEntries = result.entries.map((e) => {
				const entry = cleanServerEntry(e as unknown as Record<string, unknown>);
				return entry;
			});

			update((state) => {
				const local = state[tripId] ?? [];
				const merged = [...local];

				for (const serverEntry of serverEntries) {
					const localIdx = merged.findIndex((e) => e.dayIndex === serverEntry.dayIndex);
					const localVersion = localIdx !== -1 ? (merged[localIdx].version ?? 0) : 0;
					const serverVersion = serverEntry.version ?? 1;

					if (serverVersion > localVersion) {
						// Server is newer — accept
						if (localIdx !== -1) {
							merged[localIdx] = serverEntry;
						} else {
							merged.push(serverEntry);
						}
						dbPut('journal', idbKey(tripId, serverEntry.dayIndex), cleanForPersist(serverEntry)).catch(() => {});
					}
				}

				// Sort by dayIndex for consistent ordering
				merged.sort((a, b) => a.dayIndex - b.dayIndex);
				return { ...state, [tripId]: merged };
			});
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
			// Persist and sync just this one entry
			persistAndSyncEntry(tripId, next[idx]);
			return { ...state, [tripId]: next };
		});
	}

	return {
		subscribe,

		async init(tripId: string) {
			// Load from IndexedDB — try per-entry keys first, fall back to old blob
			const allRows = await dbGetAll<JournalEntry>('journal');
			const prefix = `${tripId}:`;
			const perEntryRows = allRows.filter((r) => r.key.startsWith(prefix));

			let entries: JournalEntry[];
			if (perEntryRows.length > 0) {
				entries = perEntryRows.map((r) => migrateEntry(r.value as unknown as Record<string, unknown>));
			} else {
				// Fall back to old blob key
				const blob = await dbGet<JournalEntry[]>('journal', tripId);
				entries = blob ? migrateAll(blob) : [];
				// Migrate blob data to per-entry keys
				if (entries.length > 0) {
					for (const e of entries) {
						await dbPut('journal', idbKey(tripId, e.dayIndex), cleanForPersist(e));
					}
					// Clean up old blob key
					await dbDelete('journal', tripId);
				}
			}

			entries.sort((a, b) => a.dayIndex - b.dayIndex);
			update((state) => ({ ...state, [tripId]: entries }));
			// Pull from server (server entries with higher versions win)
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
				// version is undefined — will be set to 1 by server on first save
			};

			update((state) => {
				const next = [...(state[tripId] ?? []), entry];
				persistAndSyncEntry(tripId, entry);
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

		removeBlock(tripId: string, dayIndex: number, blockId: string) {
			updateEntry(tripId, dayIndex, (e) => {
				const idx = e.blocks.findIndex((b) => b.id === blockId);
				if (idx === -1) return e;
				const blocks = [...e.blocks];
				blocks.splice(idx, 1);

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

				if (blocks.length === 0) {
					blocks.push({ id: crypto.randomUUID(), type: 'text', content: '' });
				}

				return { ...e, blocks, updatedAt: new Date().toISOString() };
			});
		},

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

		// ── Itinerary & metadata ──────────────────────────────────

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

		/** Pull latest from server. Call on visibility change or manual refresh. */
		async refresh(tripId: string) {
			await pullFromServer(tripId);
		},

		async deleteEntry(tripId: string, dayIndex: number) {
			const entry = getEntries(tripId).find((e) => e.dayIndex === dayIndex);
			const version = entry?.version;

			// Remove from in-memory state immediately
			update((state) => {
				const entries = state[tripId] ?? [];
				const next = entries.filter((e) => e.dayIndex !== dayIndex);
				return { ...state, [tripId]: next };
			});

			// Tombstone on server (if it has a version)
			if (version) {
				try {
					const { deleteJournalEntry } = await import('$lib/services/trips-api');
					await deleteJournalEntry(tripId, dayIndex, version);
				} catch {
					// offline — entry is removed locally
				}
			}

			// Remove from IndexedDB
			dbDelete('journal', idbKey(tripId, dayIndex)).catch(() => {});
		}
	};
}

export const journalStore = createJournalStore();
