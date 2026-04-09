import { describe, it, expect } from 'vitest';
import { buildSuggestionMessage } from '$lib/services/chat';
import type { Trip } from '$lib/types/trip';

function makeTrip(overrides?: Partial<Trip>): Trip {
	return {
		id: 'test-trip',
		name: 'Test Trip',
		startDate: '2026-04-22',
		endDate: '2026-04-25',
		destinations: ['Shanghai', 'Chongqing'],
		links: [],
		days: [
			{
				date: '2026-04-22',
				dayOfWeek: 'Wed',
				location: 'Shanghai',
				travel: 'Land at 5PM',
				morning: 'Visit temple',
				afternoon: 'Walk the Bund',
				evening: 'Dinner at hotel',
				accommodation: 'Kimpton',
				notes: '',
				ooo: false
			},
			{
				date: '2026-04-23',
				dayOfWeek: 'Thu',
				location: 'Chongqing',
				travel: '',
				morning: '',
				afternoon: '',
				evening: '',
				accommodation: 'Hyatt',
				notes: '',
				ooo: true
			}
		],
		...overrides
	};
}

describe('chat service', () => {
	describe('buildSuggestionMessage', () => {
		it('includes location, date, and day of week', () => {
			const trip = makeTrip();
			const msg = buildSuggestionMessage(trip, 0, 'morning', 'high', 'food');
			expect(msg).toContain('Shanghai');
			expect(msg).toContain('2026-04-22');
			expect(msg).toContain('Wed');
		});

		it('includes energy and interest', () => {
			const trip = makeTrip();
			const msg = buildSuggestionMessage(trip, 0, 'afternoon', 'low', 'culture');
			expect(msg).toContain('low');
			expect(msg).toContain('culture');
		});

		it('includes adjacent activity context', () => {
			const trip = makeTrip();
			// Asking for afternoon — should include morning and evening
			const msg = buildSuggestionMessage(trip, 0, 'afternoon', 'medium', 'food');
			expect(msg).toContain('Visit temple');
			expect(msg).toContain('Dinner at hotel');
		});

		it('includes known-for info for recognized destinations', () => {
			const trip = makeTrip();
			const msg = buildSuggestionMessage(trip, 0, 'morning', 'high', 'culture');
			// Shanghai is a known destination in destination-vibes
			expect(msg).toContain('known for');
		});

		it('returns empty string for invalid day index', () => {
			const trip = makeTrip();
			expect(buildSuggestionMessage(trip, 99, 'morning', 'high', 'food')).toBe('');
		});

		it('handles day with no existing activities', () => {
			const trip = makeTrip();
			const msg = buildSuggestionMessage(trip, 1, 'morning', 'low', 'nature');
			expect(msg).toContain('Chongqing');
			expect(msg).toContain('2026-04-23');
		});
	});
});
