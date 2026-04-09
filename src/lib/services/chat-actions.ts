import type { TripUpdate } from '$lib/types/chat';

const VALID_FIELDS = new Set([
	'morning', 'afternoon', 'evening', 'travel', 'accommodation', 'notes', 'location'
]);

const TRIP_UPDATE_RE = /```TRIP_UPDATE\s*\n([\s\S]*?)```/g;

export function parseTripUpdates(content: string): TripUpdate[] {
	const updates: TripUpdate[] = [];
	let match: RegExpExecArray | null;

	while ((match = TRIP_UPDATE_RE.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (
					typeof item.dayIndex === 'number' &&
					item.dayIndex >= 0 &&
					VALID_FIELDS.has(item.field) &&
					typeof item.value === 'string'
				) {
					updates.push({
						dayIndex: item.dayIndex,
						field: item.field,
						value: item.value
					});
				}
			}
		} catch {
			// malformed JSON — skip this block
		}
	}

	// Reset regex lastIndex for reuse
	TRIP_UPDATE_RE.lastIndex = 0;

	return updates;
}

export function stripTripUpdateBlocks(content: string): string {
	const stripped = content.replace(TRIP_UPDATE_RE, '').trim();
	TRIP_UPDATE_RE.lastIndex = 0;
	return stripped;
}
