import type { JournalEntry, JournalBlock, JournalTextBlock, JournalPhotoBlock, JournalPhoto } from '$lib/types/trip';

/**
 * Migrate a legacy journal entry (body + photos) to the block-based format.
 * If the entry already has a blocks array, returns it unchanged.
 * This runs transparently on load — no server migration needed.
 */
export function migrateEntry(entry: Record<string, unknown>): JournalEntry {
	// Already migrated
	if (Array.isArray(entry.blocks)) {
		return entry as unknown as JournalEntry;
	}

	const blocks: JournalBlock[] = [];

	// Convert body to a text block
	const body = typeof entry.body === 'string' ? entry.body : '';
	blocks.push({
		id: crypto.randomUUID(),
		type: 'text',
		content: body
	} satisfies JournalTextBlock);

	// Convert photos to photo blocks
	const photos = Array.isArray(entry.photos) ? (entry.photos as JournalPhoto[]) : [];
	for (const photo of photos) {
		blocks.push({
			id: photo.id || crypto.randomUUID(),
			type: 'photo',
			photoId: photo.url, // legacy photos used external URLs as the identifier
			caption: photo.caption || '',
			uploadedBy: ''
		} satisfies JournalPhotoBlock);
	}

	// Build the migrated entry, dropping legacy fields
	const migrated: JournalEntry = {
		dayIndex: entry.dayIndex as number,
		date: entry.date as string,
		location: entry.location as string,
		blocks,
		itinerary: (entry.itinerary as JournalEntry['itinerary']) ?? [],
		mood: entry.mood as JournalEntry['mood'],
		weather: entry.weather as string | undefined,
		createdAt: entry.createdAt as string,
		updatedAt: entry.updatedAt as string
	};

	return migrated;
}

/**
 * Strip transient client-only fields from photo blocks before persisting.
 */
export function stripTransientFields(blocks: JournalBlock[]): JournalBlock[] {
	return blocks.map((block) => {
		if (block.type === 'photo') {
			const { _localObjectUrl, _uploadPending, ...clean } = block;
			return clean;
		}
		return block;
	});
}
