import type {
	TripUpdate,
	MapLinksAction,
	TripCreate,
	TripDayOp,
	TripMetaAction,
	TripLinkOp,
	TodoOp,
	TourScriptAction
} from '$lib/types/chat';
import type { MapLink, Trip, TripDay } from '$lib/types/trip';

const VALID_FIELDS = new Set([
	'morning', 'afternoon', 'evening', 'travel', 'accommodation', 'notes', 'location'
]);

function getTripUpdateRegex(): RegExp {
	return /```TRIP_UPDATE\s*[\r\n]+([\s\S]*?)```/g;
}

function getMapLinksRegex(): RegExp {
	return /```MAP_LINKS\s*[\r\n]+([\s\S]*?)```/g;
}

function getTripCreateRegex(): RegExp {
	return /```TRIP_CREATE\s*[\r\n]+([\s\S]*?)```/g;
}

function getTripDaysRegex(): RegExp {
	return /```TRIP_DAYS\s*[\r\n]+([\s\S]*?)```/g;
}

function getTripMetaRegex(): RegExp {
	return /```TRIP_META\s*[\r\n]+([\s\S]*?)```/g;
}

function getTripLinksRegex(): RegExp {
	return /```TRIP_LINKS\s*[\r\n]+([\s\S]*?)```/g;
}

function getTodosRegex(): RegExp {
	return /```TODOS\s*[\r\n]+([\s\S]*?)```/g;
}

function getTourScriptRegex(): RegExp {
	return /```TOUR_SCRIPT\s*[\r\n]+([\s\S]*?)```/g;
}

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export function parseTripCreates(content: string): TripCreate[] {
	const creates: TripCreate[] = [];
	const re = getTripCreateRegex();
	let match: RegExpExecArray | null;

	while ((match = re.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (
					typeof item.id === 'string' && ID_PATTERN.test(item.id) &&
					typeof item.name === 'string' && item.name.length > 0 &&
					typeof item.startDate === 'string' && DATE_PATTERN.test(item.startDate) &&
					typeof item.endDate === 'string' && DATE_PATTERN.test(item.endDate)
				) {
					const tc: TripCreate = {
						id: item.id,
						name: item.name,
						startDate: item.startDate,
						endDate: item.endDate
					};
					if (Array.isArray(item.destinations)) {
						tc.destinations = item.destinations.filter((d: unknown) => typeof d === 'string');
					}
					if (Array.isArray(item.days)) {
						tc.days = item.days
							.filter((d: unknown) => d && typeof d === 'object')
							.map((d: Record<string, unknown>) => ({
								date: typeof d.date === 'string' ? d.date : '',
								location: typeof d.location === 'string' ? d.location : '',
								travel: typeof d.travel === 'string' ? d.travel : '',
								morning: typeof d.morning === 'string' ? d.morning : '',
								afternoon: typeof d.afternoon === 'string' ? d.afternoon : '',
								evening: typeof d.evening === 'string' ? d.evening : '',
								accommodation: typeof d.accommodation === 'string' ? d.accommodation : '',
								notes: typeof d.notes === 'string' ? d.notes : ''
							}));
					}
					creates.push(tc);
				}
			}
		} catch {
			// malformed JSON — skip
		}
	}

	return creates;
}

/**
 * Expand a TRIP_CREATE payload into a full Trip. If days are omitted, seeds
 * an empty day per calendar date between startDate and endDate (inclusive).
 */
export function tripFromCreate(tc: TripCreate): Trip {
	const days: TripDay[] = [];
	if (tc.days && tc.days.length > 0) {
		for (const d of tc.days) {
			days.push({
				date: d.date || '',
				dayOfWeek: d.date ? weekdayShort(d.date) : '',
				location: d.location || '',
				travel: d.travel || '',
				morning: d.morning || '',
				afternoon: d.afternoon || '',
				evening: d.evening || '',
				accommodation: d.accommodation || '',
				notes: d.notes || '',
				ooo: false
			});
		}
	} else {
		for (const date of dateRange(tc.startDate, tc.endDate)) {
			days.push({
				date,
				dayOfWeek: weekdayShort(date),
				location: '',
				travel: '',
				morning: '',
				afternoon: '',
				evening: '',
				accommodation: '',
				notes: '',
				ooo: false
			});
		}
	}

	return {
		id: tc.id,
		name: tc.name,
		startDate: tc.startDate,
		endDate: tc.endDate,
		destinations: tc.destinations ?? [],
		days,
		links: []
	};
}

/**
 * Derive a URL-safe slug id from a trip name + start date, avoiding collisions
 * against an existing set of ids. Used by the manual "New trip" modal.
 */
export function slugifyTripId(name: string, startDate: string, existing: Set<string>): string {
	const base = name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40) || 'trip';
	const year = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate.slice(0, 4) : '';
	// Don't double-append the year when the user already put it in the name
	// (e.g. "Europe 2026" shouldn't become "europe-2026-2026").
	const baseHasYear = year && new RegExp(`(^|-)${year}$`).test(base);
	const candidate = year && !baseHasYear ? `${base}-${year}` : base;
	if (!existing.has(candidate)) return candidate;
	let i = 2;
	while (existing.has(`${candidate}-${i}`)) i += 1;
	return `${candidate}-${i}`;
}

/**
 * Spread N destinations evenly across D days — e.g. 3 destinations over
 * 21 days → days 0-6 get destinations[0], 7-13 get [1], 14-20 get [2].
 * Used when a newly created trip has destinations but empty day locations.
 */
export function distributeDestinations(days: number, destinations: string[]): string[] {
	if (days <= 0 || destinations.length === 0) return [];
	const out: string[] = new Array(days);
	for (let i = 0; i < days; i++) {
		const idx = Math.min(
			destinations.length - 1,
			Math.floor((i * destinations.length) / days)
		);
		out[i] = destinations[idx];
	}
	return out;
}

function weekdayShort(date: string): string {
	const d = new Date(date + 'T12:00:00');
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function dateRange(start: string, end: string): string[] {
	const dates: string[] = [];
	const s = new Date(start + 'T12:00:00');
	const e = new Date(end + 'T12:00:00');
	if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return dates;
	// Hard cap to prevent runaway ranges from a bogus agent response
	for (let i = 0; i < 365; i++) {
		const d = new Date(s);
		d.setDate(s.getDate() + i);
		dates.push(d.toISOString().split('T')[0]);
		if (d.getTime() >= e.getTime()) break;
	}
	return dates;
}

export function parseTripDayOps(content: string): TripDayOp[] {
	const ops: TripDayOp[] = [];
	const re = getTripDaysRegex();
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (!item || typeof item !== 'object') continue;
				const op = item.op;
				if (op === 'add') {
					const after = typeof item.afterIndex === 'number' ? item.afterIndex : undefined;
					ops.push({ op: 'add', afterIndex: after });
				} else if (op === 'delete' && typeof item.dayIndex === 'number' && item.dayIndex >= 0) {
					ops.push({ op: 'delete', dayIndex: item.dayIndex });
				} else if (op === 'duplicate' && typeof item.dayIndex === 'number' && item.dayIndex >= 0) {
					ops.push({ op: 'duplicate', dayIndex: item.dayIndex });
				} else if (
					op === 'move' &&
					typeof item.dayIndex === 'number' && item.dayIndex >= 0 &&
					(item.direction === 'up' || item.direction === 'down')
				) {
					ops.push({ op: 'move', dayIndex: item.dayIndex, direction: item.direction });
				}
			}
		} catch {
			// malformed — skip
		}
	}
	return ops;
}

export function parseTripMeta(content: string): TripMetaAction[] {
	const metas: TripMetaAction[] = [];
	const re = getTripMetaRegex();
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
			const meta: TripMetaAction = {};
			if (typeof parsed.name === 'string' && parsed.name.length > 0) meta.name = parsed.name;
			if (typeof parsed.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate)) meta.startDate = parsed.startDate;
			if (typeof parsed.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.endDate)) meta.endDate = parsed.endDate;
			if (Array.isArray(parsed.destinations)) {
				meta.destinations = parsed.destinations.filter((d: unknown): d is string => typeof d === 'string');
			}
			if (Object.keys(meta).length > 0) metas.push(meta);
		} catch {
			// skip
		}
	}
	return metas;
}

export function parseTripLinkOps(content: string): TripLinkOp[] {
	const ops: TripLinkOp[] = [];
	const re = getTripLinksRegex();
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (!item || typeof item !== 'object') continue;
				const op = item.op;
				if (op === 'add' && typeof item.url === 'string' && item.url.length > 0) {
					ops.push({ op: 'add', url: item.url });
				} else if (
					op === 'update' &&
					typeof item.linkIndex === 'number' && item.linkIndex >= 0 &&
					typeof item.url === 'string' && item.url.length > 0
				) {
					ops.push({ op: 'update', linkIndex: item.linkIndex, url: item.url });
				} else if (op === 'delete' && typeof item.linkIndex === 'number' && item.linkIndex >= 0) {
					ops.push({ op: 'delete', linkIndex: item.linkIndex });
				}
			}
		} catch {
			// skip
		}
	}
	return ops;
}

export function parseTodoOps(content: string): TodoOp[] {
	const ops: TodoOp[] = [];
	const re = getTodosRegex();
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (!item || typeof item !== 'object') continue;
				const op = item.op;
				if (op === 'add' && typeof item.text === 'string' && item.text.trim().length > 0) {
					ops.push({ op: 'add', text: item.text });
				} else if (
					op === 'update' &&
					typeof item.todoIndex === 'number' && item.todoIndex >= 0 &&
					typeof item.text === 'string' && item.text.length > 0
				) {
					ops.push({ op: 'update', todoIndex: item.todoIndex, text: item.text });
				} else if (op === 'toggle' && typeof item.todoIndex === 'number' && item.todoIndex >= 0) {
					ops.push({ op: 'toggle', todoIndex: item.todoIndex });
				} else if (op === 'delete' && typeof item.todoIndex === 'number' && item.todoIndex >= 0) {
					ops.push({ op: 'delete', todoIndex: item.todoIndex });
				}
			}
		} catch {
			// skip
		}
	}
	return ops;
}

export function stripTripUpdateBlocks(content: string): string {
	return content.replace(getTripUpdateRegex(), '').trim();
}

export function stripMapLinksBlocks(content: string): string {
	return content.replace(getMapLinksRegex(), '').trim();
}

export function stripTripCreateBlocks(content: string): string {
	return content.replace(getTripCreateRegex(), '').trim();
}

export function stripTripDaysBlocks(content: string): string {
	return content.replace(getTripDaysRegex(), '').trim();
}

export function stripTripMetaBlocks(content: string): string {
	return content.replace(getTripMetaRegex(), '').trim();
}

export function stripTripLinksBlocks(content: string): string {
	return content.replace(getTripLinksRegex(), '').trim();
}

export function stripTodosBlocks(content: string): string {
	return content.replace(getTodosRegex(), '').trim();
}

export function parseTourScripts(content: string): TourScriptAction[] {
	const scripts: TourScriptAction[] = [];
	const re = getTourScriptRegex();
	let match: RegExpExecArray | null;
	while ((match = re.exec(content)) !== null) {
		try {
			const parsed = JSON.parse(match[1]);
			const items = Array.isArray(parsed) ? parsed : [parsed];
			for (const item of items) {
				if (
					typeof item.dayIndex === 'number' &&
					item.dayIndex >= 0 &&
					typeof item.title === 'string' &&
					item.title.length > 0 &&
					typeof item.content === 'string' &&
					item.content.length > 0
				) {
					scripts.push({
						dayIndex: item.dayIndex,
						title: item.title,
						content: item.content
					});
				}
			}
		} catch {
			// malformed JSON — skip
		}
	}
	return scripts;
}

export function stripTourScriptBlocks(content: string): string {
	return content.replace(getTourScriptRegex(), '').trim();
}

export function stripAllActionBlocks(content: string): string {
	let out = content;
	out = stripTripUpdateBlocks(out);
	out = stripMapLinksBlocks(out);
	out = stripTripCreateBlocks(out);
	out = stripTripDaysBlocks(out);
	out = stripTripMetaBlocks(out);
	out = stripTripLinksBlocks(out);
	out = stripTodosBlocks(out);
	out = stripTourScriptBlocks(out);
	return out;
}
