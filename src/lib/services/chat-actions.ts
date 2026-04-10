import type { TripUpdate, MapLinksAction } from '$lib/types/chat';
import type { MapLink } from '$lib/types/trip';

const VALID_FIELDS = new Set([
	'morning', 'afternoon', 'evening', 'travel', 'accommodation', 'notes', 'location'
]);

function getTripUpdateRegex(): RegExp {
	return /```TRIP_UPDATE\s*[\r\n]+([\s\S]*?)```/g;
}

function getMapLinksRegex(): RegExp {
	return /```MAP_LINKS\s*[\r\n]+([\s\S]*?)```/g;
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

function isValidMapLink(item: unknown): item is MapLink {
	if (!item || typeof item !== 'object') return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.label === 'string' && obj.label.length > 0 &&
		typeof obj.from === 'string' && obj.from.length > 0 &&
		typeof obj.to === 'string' && obj.to.length > 0
	);
}

export function parseMapLinksActions(content: string): MapLinksAction[] {
	const actions: MapLinksAction[] = [];
	const re = getMapLinksRegex();
	let match: RegExpExecArray | null;

	while ((match = re.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (
					typeof item.dayIndex === 'number' &&
					item.dayIndex >= 0 &&
					Array.isArray(item.mapLinks) &&
					item.mapLinks.length > 0 &&
					item.mapLinks.every(isValidMapLink)
				) {
					actions.push({
						dayIndex: item.dayIndex,
						mapLinks: item.mapLinks.map((l: MapLink) => ({
							label: l.label,
							from: l.from,
							to: l.to
						}))
					});
				}
			}
		} catch {
			// malformed JSON — skip this block
		}
	}

	return actions;
}

export function stripTripUpdateBlocks(content: string): string {
	return content.replace(getTripUpdateRegex(), '').trim();
}

export function stripMapLinksBlocks(content: string): string {
	return content.replace(getMapLinksRegex(), '').trim();
}

export function stripAllActionBlocks(content: string): string {
	return stripMapLinksBlocks(stripTripUpdateBlocks(content));
}
