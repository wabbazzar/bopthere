import { describe, it, expect } from 'vitest';
import {
	parseTripUpdates,
	stripTripUpdateBlocks,
	parseMapLinksActions,
	stripMapLinksBlocks,
	stripAllActionBlocks,
	parseTripCreates,
	stripTripCreateBlocks,
	tripFromCreate,
	slugifyTripId,
	distributeDestinations
} from '$lib/services/chat-actions';

describe('chat-actions', () => {
	describe('parseTripUpdates', () => {
		it('parses a single update', () => {
			const content = 'I\'ll add that for you.\n\n```TRIP_UPDATE\n[{"dayIndex": 2, "field": "evening", "value": "Din Tai Fung"}]\n```';
			const updates = parseTripUpdates(content);
			expect(updates).toHaveLength(1);
			expect(updates[0]).toEqual({ dayIndex: 2, field: 'evening', value: 'Din Tai Fung' });
		});

		it('parses multiple updates in one block', () => {
			const content = '```TRIP_UPDATE\n[{"dayIndex": 0, "field": "morning", "value": "Temple visit"}, {"dayIndex": 0, "field": "afternoon", "value": "Lunch at market"}]\n```';
			const updates = parseTripUpdates(content);
			expect(updates).toHaveLength(2);
			expect(updates[0].field).toBe('morning');
			expect(updates[1].field).toBe('afternoon');
		});

		it('rejects invalid field names', () => {
			const content = '```TRIP_UPDATE\n[{"dayIndex": 0, "field": "hackerField", "value": "bad"}]\n```';
			expect(parseTripUpdates(content)).toHaveLength(0);
		});

		it('rejects negative dayIndex', () => {
			const content = '```TRIP_UPDATE\n[{"dayIndex": -1, "field": "morning", "value": "x"}]\n```';
			expect(parseTripUpdates(content)).toHaveLength(0);
		});

		it('rejects non-string value', () => {
			const content = '```TRIP_UPDATE\n[{"dayIndex": 0, "field": "morning", "value": 42}]\n```';
			expect(parseTripUpdates(content)).toHaveLength(0);
		});

		it('handles malformed JSON gracefully', () => {
			const content = '```TRIP_UPDATE\n{not valid json\n```';
			expect(parseTripUpdates(content)).toHaveLength(0);
		});

		it('returns empty for content with no TRIP_UPDATE block', () => {
			const content = 'Here are some restaurant suggestions:\n1. Place A\n2. Place B';
			expect(parseTripUpdates(content)).toHaveLength(0);
		});

		it('parses all valid fields', () => {
			const fields = ['morning', 'afternoon', 'evening', 'travel', 'accommodation', 'notes', 'location'];
			for (const field of fields) {
				const content = `\`\`\`TRIP_UPDATE\n[{"dayIndex": 0, "field": "${field}", "value": "test"}]\n\`\`\``;
				const updates = parseTripUpdates(content);
				expect(updates).toHaveLength(1);
				expect(updates[0].field).toBe(field);
			}
		});

		it('can be called multiple times (regex lastIndex reset)', () => {
			const content = '```TRIP_UPDATE\n[{"dayIndex": 0, "field": "morning", "value": "A"}]\n```';
			expect(parseTripUpdates(content)).toHaveLength(1);
			expect(parseTripUpdates(content)).toHaveLength(1);
		});
	});

	describe('stripTripUpdateBlocks', () => {
		it('removes TRIP_UPDATE block from content', () => {
			const content = 'Here is my suggestion.\n\n```TRIP_UPDATE\n[{"dayIndex": 0, "field": "morning", "value": "A"}]\n```';
			expect(stripTripUpdateBlocks(content)).toBe('Here is my suggestion.');
		});

		it('returns content unchanged when no block present', () => {
			const content = 'Just a normal message.';
			expect(stripTripUpdateBlocks(content)).toBe('Just a normal message.');
		});

		it('removes multiple blocks', () => {
			const content = 'Text\n```TRIP_UPDATE\n[]\n```\nMore\n```TRIP_UPDATE\n[]\n```';
			expect(stripTripUpdateBlocks(content)).toBe('Text\n\nMore');
		});
	});

	describe('parseMapLinksActions', () => {
		it('parses a single map links action', () => {
			const content = '```MAP_LINKS\n{"dayIndex": 7, "mapLinks": [{"label": "Hotel to Mountain", "from": "Hampton by Hilton", "to": "Tianmen Mountain"}]}\n```';
			const actions = parseMapLinksActions(content);
			expect(actions).toHaveLength(1);
			expect(actions[0].dayIndex).toBe(7);
			expect(actions[0].mapLinks).toHaveLength(1);
			expect(actions[0].mapLinks[0]).toEqual({ label: 'Hotel to Mountain', from: 'Hampton by Hilton', to: 'Tianmen Mountain' });
		});

		it('parses multiple map links in one action', () => {
			const content = '```MAP_LINKS\n{"dayIndex": 7, "mapLinks": [{"label": "A to B", "from": "A", "to": "B"}, {"label": "B to C", "from": "B", "to": "C"}]}\n```';
			const actions = parseMapLinksActions(content);
			expect(actions).toHaveLength(1);
			expect(actions[0].mapLinks).toHaveLength(2);
		});

		it('rejects empty mapLinks array', () => {
			const content = '```MAP_LINKS\n{"dayIndex": 0, "mapLinks": []}\n```';
			expect(parseMapLinksActions(content)).toHaveLength(0);
		});

		it('rejects missing label', () => {
			const content = '```MAP_LINKS\n{"dayIndex": 0, "mapLinks": [{"from": "A", "to": "B"}]}\n```';
			expect(parseMapLinksActions(content)).toHaveLength(0);
		});

		it('rejects empty from string', () => {
			const content = '```MAP_LINKS\n{"dayIndex": 0, "mapLinks": [{"label": "X", "from": "", "to": "B"}]}\n```';
			expect(parseMapLinksActions(content)).toHaveLength(0);
		});

		it('rejects negative dayIndex', () => {
			const content = '```MAP_LINKS\n{"dayIndex": -1, "mapLinks": [{"label": "X", "from": "A", "to": "B"}]}\n```';
			expect(parseMapLinksActions(content)).toHaveLength(0);
		});

		it('handles malformed JSON', () => {
			const content = '```MAP_LINKS\n{broken json\n```';
			expect(parseMapLinksActions(content)).toHaveLength(0);
		});

		it('returns empty for content with no MAP_LINKS block', () => {
			expect(parseMapLinksActions('just text')).toHaveLength(0);
		});

		it('only extracts label/from/to (no extra fields)', () => {
			const content = '```MAP_LINKS\n{"dayIndex": 0, "mapLinks": [{"label": "X", "from": "A", "to": "B", "extra": "bad"}]}\n```';
			const actions = parseMapLinksActions(content);
			expect(actions).toHaveLength(1);
			expect(actions[0].mapLinks[0]).toEqual({ label: 'X', from: 'A', to: 'B' });
		});
	});

	describe('stripMapLinksBlocks', () => {
		it('removes MAP_LINKS block', () => {
			const content = 'Here are directions.\n\n```MAP_LINKS\n{"dayIndex": 0, "mapLinks": []}\n```';
			expect(stripMapLinksBlocks(content)).toBe('Here are directions.');
		});
	});

	describe('stripAllActionBlocks', () => {
		it('strips both TRIP_UPDATE and MAP_LINKS', () => {
			const content = 'Text\n```TRIP_UPDATE\n[]\n```\nMore\n```MAP_LINKS\n{}\n```\nEnd';
			expect(stripAllActionBlocks(content)).toBe('Text\n\nMore\n\nEnd');
		});

		it('also strips TRIP_CREATE', () => {
			const content = 'Plan:\n```TRIP_CREATE\n{"id":"japan-2026","name":"Japan","startDate":"2026-10-10","endDate":"2026-10-12"}\n```\nEnd';
			expect(stripAllActionBlocks(content)).toBe('Plan:\n\nEnd');
		});
	});

	describe('parseTripCreates', () => {
		const valid = '```TRIP_CREATE\n{"id":"japan-2026-10","name":"Japan Oct 2026","startDate":"2026-10-10","endDate":"2026-10-20","destinations":["Tokyo","Kyoto"]}\n```';

		it('parses a valid TRIP_CREATE block', () => {
			const creates = parseTripCreates(valid);
			expect(creates).toHaveLength(1);
			expect(creates[0].id).toBe('japan-2026-10');
			expect(creates[0].name).toBe('Japan Oct 2026');
			expect(creates[0].destinations).toEqual(['Tokyo', 'Kyoto']);
		});

		it('rejects invalid id with uppercase or spaces', () => {
			const bad = '```TRIP_CREATE\n{"id":"Japan 2026","name":"x","startDate":"2026-10-10","endDate":"2026-10-20"}\n```';
			expect(parseTripCreates(bad)).toHaveLength(0);
		});

		it('rejects id with path traversal chars', () => {
			const bad = '```TRIP_CREATE\n{"id":"../etc","name":"x","startDate":"2026-10-10","endDate":"2026-10-20"}\n```';
			expect(parseTripCreates(bad)).toHaveLength(0);
		});

		it('rejects bad date formats', () => {
			const bad = '```TRIP_CREATE\n{"id":"ok","name":"x","startDate":"10/10/2026","endDate":"2026-10-20"}\n```';
			expect(parseTripCreates(bad)).toHaveLength(0);
		});

		it('rejects empty name', () => {
			const bad = '```TRIP_CREATE\n{"id":"ok","name":"","startDate":"2026-10-10","endDate":"2026-10-20"}\n```';
			expect(parseTripCreates(bad)).toHaveLength(0);
		});

		it('handles malformed JSON gracefully', () => {
			expect(parseTripCreates('```TRIP_CREATE\nnot json\n```')).toHaveLength(0);
		});

		it('carries through optional days array', () => {
			const content = '```TRIP_CREATE\n{"id":"p","name":"P","startDate":"2026-10-10","endDate":"2026-10-11","days":[{"date":"2026-10-10","location":"Lisbon","morning":"Alfama walk"}]}\n```';
			const creates = parseTripCreates(content);
			expect(creates[0].days).toHaveLength(1);
			expect(creates[0].days![0].location).toBe('Lisbon');
		});
	});

	describe('stripTripCreateBlocks', () => {
		it('removes TRIP_CREATE block', () => {
			const content = 'New trip proposed.\n```TRIP_CREATE\n{"id":"p","name":"P","startDate":"2026-10-10","endDate":"2026-10-11"}\n```';
			expect(stripTripCreateBlocks(content)).toBe('New trip proposed.');
		});
	});

	describe('tripFromCreate', () => {
		it('seeds one empty day per calendar date when days is omitted', () => {
			const trip = tripFromCreate({
				id: 'p', name: 'P', startDate: '2026-10-10', endDate: '2026-10-12'
			});
			expect(trip.days).toHaveLength(3);
			expect(trip.days[0].date).toBe('2026-10-10');
			expect(trip.days[2].date).toBe('2026-10-12');
			expect(trip.days[0].dayOfWeek).toBeTruthy();
			expect(trip.days[0].location).toBe('');
			expect(trip.links).toEqual([]);
		});

		it('honors provided days', () => {
			const trip = tripFromCreate({
				id: 'p', name: 'P', startDate: '2026-10-10', endDate: '2026-10-11',
				days: [{ date: '2026-10-10', location: 'Lisbon', morning: 'Alfama' }]
			});
			expect(trip.days).toHaveLength(1);
			expect(trip.days[0].location).toBe('Lisbon');
			expect(trip.days[0].morning).toBe('Alfama');
			expect(trip.days[0].ooo).toBe(false);
		});

		it('caps runaway ranges at 365 days', () => {
			const trip = tripFromCreate({
				id: 'p', name: 'P', startDate: '2026-01-01', endDate: '2099-12-31'
			});
			expect(trip.days.length).toBeLessThanOrEqual(365);
		});
	});

	describe('slugifyTripId', () => {
		it('lowercases, strips punctuation, appends year', () => {
			expect(slugifyTripId('Europe Summer', '2026-06-12', new Set())).toBe('europe-summer-2026');
		});

		it('does not double-append the year when the name already ends in it', () => {
			expect(slugifyTripId('Europe 2026', '2026-06-12', new Set())).toBe('europe-2026');
			expect(slugifyTripId('Europe Summer 2026', '2026-06-12', new Set())).toBe('europe-summer-2026');
		});

		it('still appends year when only an embedded year appears mid-slug', () => {
			// Year in the middle (not trailing) shouldn't suppress the suffix
			expect(slugifyTripId('2026 Europe Trip', '2026-06-12', new Set())).toBe('2026-europe-trip-2026');
		});

		it('handles diacritics', () => {
			expect(slugifyTripId('São Paulo Getaway', '2026-06-12', new Set())).toBe('sao-paulo-getaway-2026');
		});

		it('collapses symbols and trims hyphens', () => {
			expect(slugifyTripId('  !!! Wild $$Ride!!  ', '2027-01-05', new Set())).toBe('wild-ride-2027');
		});

		it('falls back to "trip" on all-symbol names', () => {
			expect(slugifyTripId('!!!', '2026-06-12', new Set())).toBe('trip-2026');
		});

		it('avoids collisions by appending a counter', () => {
			const existing = new Set(['europe-2026', 'europe-2026-2', 'europe-2026-3']);
			expect(slugifyTripId('Europe', '2026-06-12', existing)).toBe('europe-2026-4');
		});

		it('omits year suffix when startDate is invalid', () => {
			expect(slugifyTripId('Japan', 'not-a-date', new Set())).toBe('japan');
		});
	});

	describe('distributeDestinations', () => {
		it('returns empty when there are no destinations', () => {
			expect(distributeDestinations(10, [])).toEqual([]);
		});

		it('returns empty when there are no days', () => {
			expect(distributeDestinations(0, ['Paris'])).toEqual([]);
		});

		it('evenly splits 3 destinations across 21 days (7 each)', () => {
			const out = distributeDestinations(21, ['Barcelona', 'Cannes', 'Lisbon']);
			expect(out).toHaveLength(21);
			expect(out.slice(0, 7).every((x) => x === 'Barcelona')).toBe(true);
			expect(out.slice(7, 14).every((x) => x === 'Cannes')).toBe(true);
			expect(out.slice(14, 21).every((x) => x === 'Lisbon')).toBe(true);
		});

		it('handles non-divisible lengths (e.g. 5 days, 3 destinations)', () => {
			const out = distributeDestinations(5, ['A', 'B', 'C']);
			expect(out).toHaveLength(5);
			expect(out[0]).toBe('A');
			expect(out[out.length - 1]).toBe('C');
			// Every destination appears at least once
			expect(new Set(out)).toEqual(new Set(['A', 'B', 'C']));
		});

		it('fewer days than destinations still covers the start', () => {
			const out = distributeDestinations(2, ['A', 'B', 'C', 'D']);
			expect(out).toHaveLength(2);
			expect(out[0]).toBe('A');
		});

		it('single destination fills all days', () => {
			expect(distributeDestinations(4, ['Tokyo'])).toEqual(['Tokyo', 'Tokyo', 'Tokyo', 'Tokyo']);
		});
	});
});
