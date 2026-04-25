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

/** Format a local date as YYYY-MM-DD (avoids UTC drift from toISOString). */
function localDateStr(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function daysFromNow(offset: number): string {
	const d = new Date();
	d.setDate(d.getDate() + offset);
	return localDateStr(d);
}

describe('BookingsSection date splitting', () => {
	it('treats today as upcoming', () => {
		expect(isUpcoming(daysFromNow(0))).toBe(true);
	});

	it('treats yesterday as past', () => {
		expect(isUpcoming(daysFromNow(-1))).toBe(false);
	});

	it('treats tomorrow as upcoming', () => {
		expect(isUpcoming(daysFromNow(1))).toBe(true);
	});

	it('splits a mixed list correctly', () => {
		const yesterday = daysFromNow(-1);
		const tomorrow = daysFromNow(1);
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
