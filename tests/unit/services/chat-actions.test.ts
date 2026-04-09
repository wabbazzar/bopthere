import { describe, it, expect } from 'vitest';
import { parseTripUpdates, stripTripUpdateBlocks } from '$lib/services/chat-actions';

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
});
