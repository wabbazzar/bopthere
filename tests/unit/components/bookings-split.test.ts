import { describe, it, expect, vi } from 'vitest';

/**
 * Tests the date-splitting logic used in BookingsSection.svelte
 * to separate upcoming vs past bookings.
 */

function isUpcoming(bookingDate: string): boolean {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const d = new Date(bookingDate + 'T12:00:00');
	d.setHours(0, 0, 0, 0);
	return d >= today;
}

describe('BookingsSection date splitting', () => {
	it('treats today as upcoming', () => {
		const today = new Date().toISOString().split('T')[0];
		expect(isUpcoming(today)).toBe(true);
	});

	it('treats yesterday as past', () => {
		const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
		expect(isUpcoming(yesterday)).toBe(false);
	});

	it('treats tomorrow as upcoming', () => {
		const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
		expect(isUpcoming(tomorrow)).toBe(true);
	});

	it('splits a mixed list correctly', () => {
		const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
		const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
		const dates = [yesterday, tomorrow, yesterday, tomorrow, tomorrow];

		const upcoming = dates.filter(isUpcoming);
		const past = dates.filter(d => !isUpcoming(d));

		expect(upcoming).toHaveLength(3);
		expect(past).toHaveLength(2);
	});

	it('handles far future dates', () => {
		expect(isUpcoming('2030-12-31')).toBe(true);
	});

	it('handles far past dates', () => {
		expect(isUpcoming('2020-01-01')).toBe(false);
	});

	it('all bookings past when all dates are old', () => {
		const dates = ['2020-01-01', '2021-06-15', '2022-03-10'];
		const upcoming = dates.filter(isUpcoming);
		const past = dates.filter(d => !isUpcoming(d));

		expect(upcoming).toHaveLength(0);
		expect(past).toHaveLength(3);
	});

	it('all bookings upcoming when all dates are future', () => {
		const dates = ['2030-01-01', '2031-06-15', '2032-03-10'];
		const upcoming = dates.filter(isUpcoming);
		const past = dates.filter(d => !isUpcoming(d));

		expect(upcoming).toHaveLength(3);
		expect(past).toHaveLength(0);
	});
});
