import type { TripUpdate } from '$lib/types/chat';

const VALID_FIELDS = new Set([
	'morning', 'afternoon', 'evening', 'travel', 'accommodation', 'notes', 'location'
]);

// Match triple-backtick TRIP_UPDATE blocks with flexible whitespace
// Handles: ```TRIP_UPDATE\n...\n```, ```TRIP_UPDATE \r\n...\r\n```, etc.
function getTripUpdateRegex(): RegExp {
	return /```TRIP_UPDATE\s*[\r\n]+([\s\S]*?)```/g;
}

export function parseTripUpdates(content: string): TripUpdate[] {
	const updates: TripUpdate[] = [];
	const re = getTripUpdateRegex();
	let match: RegExpExecArray | null;

	while ((match = re.exec(content)) !== null) {
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

	return updates;
}

export function stripTripUpdateBlocks(content: string): string {
	return content.replace(getTripUpdateRegex(), '').trim();
}
