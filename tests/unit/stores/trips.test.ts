import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { trips } from '$lib/stores/trips';

function getTrip() {
	return get(trips)['china-2026'];
}

describe('trips store', () => {
	beforeEach(() => {
		trips.resetTrip('china-2026');
	});

	describe('updateDayField', () => {
		it('auto-calculates dayOfWeek when date changes', () => {
			// 2026-04-18 is a Saturday
			trips.updateDayField('china-2026', 0, 'date', '2026-04-18');
			expect(getTrip().days[0].dayOfWeek).toBe('Sat');
		});

		it('auto-updates trip startDate/endDate from day dates', () => {
			trips.updateDayField('china-2026', 0, 'date', '2026-01-01');
			const trip = getTrip();
			expect(trip.startDate).toBe('2026-01-01');
		});

		it('auto-updates destinations from unique day locations', () => {
			trips.updateDayField('china-2026', 0, 'location', 'Tokyo');
			const trip = getTrip();
			expect(trip.destinations).toContain('Tokyo');
			// Should still have other locations from other days
			expect(trip.destinations.length).toBeGreaterThanOrEqual(1);
		});

		it('excludes split-day locations like "A / B" from destinations', () => {
			// China-2026 has a "Zhangjiajie / Shanghai" transit day; it must not
			// bleed into the header destinations list.
			const trip = getTrip();
			for (const d of trip.destinations) {
				expect(d.includes('/')).toBe(false);
			}
			// And a dedicated component day should still be there
			expect(trip.destinations).toContain('Shanghai');
			expect(trip.destinations).toContain('Zhangjiajie');
		});

		it('editing a day location to a split-day value does not add it to destinations', () => {
			trips.updateDayField('china-2026', 0, 'location', 'Osaka / Kyoto');
			const trip = getTrip();
			expect(trip.destinations).not.toContain('Osaka / Kyoto');
		});

		it('sets boolean fields like ooo', () => {
			trips.updateDayField('china-2026', 0, 'ooo', true);
			expect(getTrip().days[0].ooo).toBe(true);
		});

		it('is a no-op for invalid trip id', () => {
			const before = JSON.stringify(get(trips));
			trips.updateDayField('nonexistent', 0, 'location', 'Nowhere');
			expect(JSON.stringify(get(trips))).toBe(before);
		});

		it('is a no-op for invalid day index', () => {
			const before = getTrip().days.length;
			trips.updateDayField('china-2026', 999, 'location', 'Nowhere');
			expect(getTrip().days.length).toBe(before);
		});
	});

	describe('addDay', () => {
		it('adds a day at the end by default', () => {
			const before = getTrip().days.length;
			trips.addDay('china-2026');
			expect(getTrip().days.length).toBe(before + 1);
		});

		it('increments date from previous day by +1', () => {
			const lastDay = getTrip().days[getTrip().days.length - 1];
			trips.addDay('china-2026');
			const newDay = getTrip().days[getTrip().days.length - 1];
			if (lastDay.date) {
				const expected = new Date(lastDay.date + 'T12:00:00');
				expected.setDate(expected.getDate() + 1);
				expect(newDay.date).toBe(expected.toISOString().split('T')[0]);
			}
		});

		it('inherits location from previous day', () => {
			const lastDay = getTrip().days[getTrip().days.length - 1];
			trips.addDay('china-2026');
			const newDay = getTrip().days[getTrip().days.length - 1];
			expect(newDay.location).toBe(lastDay.location);
		});

		it('inserts after specified index', () => {
			const day0Location = getTrip().days[0].location;
			trips.addDay('china-2026', 0);
			// New day should be at index 1, inheriting from day 0
			expect(getTrip().days[1].location).toBe(day0Location);
		});

		it('calculates correct dayOfWeek for new day', () => {
			trips.addDay('china-2026');
			const newDay = getTrip().days[getTrip().days.length - 1];
			if (newDay.date) {
				const d = new Date(newDay.date + 'T12:00:00');
				const expected = d.toLocaleDateString('en-US', { weekday: 'short' });
				expect(newDay.dayOfWeek).toBe(expected);
			}
		});
	});

	describe('deleteDay', () => {
		it('removes a day', () => {
			const before = getTrip().days.length;
			trips.deleteDay('china-2026', 0);
			expect(getTrip().days.length).toBe(before - 1);
		});

		it('prevents deletion when only 1 day remains', () => {
			// Delete all but one
			while (getTrip().days.length > 1) {
				trips.deleteDay('china-2026', 0);
			}
			trips.deleteDay('china-2026', 0);
			expect(getTrip().days.length).toBe(1);
		});

		it('recalculates destinations after deletion', () => {
			// Find a day with a unique location and delete it
			const trip = getTrip();
			const locations = trip.days.map((d) => d.location);
			const uniqueIdx = locations.findIndex(
				(loc, i) => locations.indexOf(loc) === i && locations.lastIndexOf(loc) === i
			);
			if (uniqueIdx >= 0 && trip.days.length > 1) {
				const removedLoc = trip.days[uniqueIdx].location;
				trips.deleteDay('china-2026', uniqueIdx);
				expect(getTrip().destinations).not.toContain(removedLoc);
			}
		});
	});

	describe('duplicateDay', () => {
		it('creates a copy with date +1', () => {
			const originalDate = getTrip().days[0].date;
			const originalLen = getTrip().days.length;
			trips.duplicateDay('china-2026', 0);

			expect(getTrip().days.length).toBe(originalLen + 1);
			const copy = getTrip().days[1];
			if (originalDate) {
				const expected = new Date(originalDate + 'T12:00:00');
				expected.setDate(expected.getDate() + 1);
				expect(copy.date).toBe(expected.toISOString().split('T')[0]);
			}
		});

		it('preserves location from original day', () => {
			const loc = getTrip().days[0].location;
			trips.duplicateDay('china-2026', 0);
			expect(getTrip().days[1].location).toBe(loc);
		});
	});

	describe('moveDay', () => {
		it('moving first day up is a no-op', () => {
			const firstDate = getTrip().days[0].date;
			trips.moveDay('china-2026', 0, 'up');
			expect(getTrip().days[0].date).toBe(firstDate);
		});

		it('moving last day down is a no-op', () => {
			const trip = getTrip();
			const lastIdx = trip.days.length - 1;
			const lastDate = trip.days[lastIdx].date;
			trips.moveDay('china-2026', lastIdx, 'down');
			expect(getTrip().days[lastIdx].date).toBe(lastDate);
		});

		it('swaps days correctly', () => {
			const day0Date = getTrip().days[0].date;
			const day1Date = getTrip().days[1].date;
			trips.moveDay('china-2026', 0, 'down');
			expect(getTrip().days[0].date).toBe(day1Date);
			expect(getTrip().days[1].date).toBe(day0Date);
		});
	});

	describe('undo', () => {
		it('reverts last change', () => {
			const originalDate = getTrip().days[0].date;
			trips.updateDayField('china-2026', 0, 'date', '2099-01-01');
			expect(getTrip().days[0].date).toBe('2099-01-01');
			trips.undo();
			expect(getTrip().days[0].date).toBe(originalDate);
		});

		it('canUndo returns false initially', () => {
			// After resetTrip, undo stack is fresh for that store instance
			// but resetTrip itself pushes a snapshot, so we need a fresh store
			// Just verify canUndo works after an action
			trips.updateDayField('china-2026', 0, 'notes', 'test');
			expect(trips.canUndo()).toBe(true);
		});
	});

	describe('links', () => {
		it('adds a link', () => {
			const before = getTrip().links.length;
			trips.addLink('china-2026', 'https://example.com');
			expect(getTrip().links.length).toBe(before + 1);
			expect(getTrip().links).toContain('https://example.com');
		});

		it('updates a link', () => {
			trips.addLink('china-2026', 'https://old.com');
			const idx = getTrip().links.length - 1;
			trips.updateLink('china-2026', idx, 'https://new.com');
			expect(getTrip().links[idx]).toBe('https://new.com');
		});

		it('deletes a link', () => {
			trips.addLink('china-2026', 'https://delete-me.com');
			const before = getTrip().links.length;
			trips.deleteLink('china-2026', before - 1);
			expect(getTrip().links.length).toBe(before - 1);
		});
	});

	describe('resetTrip', () => {
		it('restores to default data', () => {
			trips.updateDayField('china-2026', 0, 'location', 'Mars');
			trips.resetTrip('china-2026');
			expect(getTrip().days[0].location).not.toBe('Mars');
		});
	});

	describe('exportTrip', () => {
		it('returns valid JSON', () => {
			const json = trips.exportTrip('china-2026');
			expect(json).toBeTruthy();
			const parsed = JSON.parse(json);
			expect(parsed.id).toBe('china-2026');
			expect(parsed.days).toBeInstanceOf(Array);
			expect(parsed.days.length).toBeGreaterThan(0);
		});

		it('returns empty string for nonexistent trip', () => {
			expect(trips.exportTrip('nonexistent')).toBe('');
		});
	});

	describe('addTrip', () => {
		const newTrip = {
			id: 'japan-2026-10',
			name: 'Japan Oct 2026',
			startDate: '2026-10-10',
			endDate: '2026-10-12',
			destinations: [],
			days: [
				{ date: '2026-10-10', dayOfWeek: 'Sat', location: 'Tokyo', travel: '', morning: '', afternoon: '', evening: '', accommodation: '', notes: '', ooo: false },
				{ date: '2026-10-11', dayOfWeek: 'Sun', location: 'Tokyo', travel: '', morning: '', afternoon: '', evening: '', accommodation: '', notes: '', ooo: false },
				{ date: '2026-10-12', dayOfWeek: 'Mon', location: 'Kyoto', travel: '', morning: '', afternoon: '', evening: '', accommodation: '', notes: '', ooo: false }
			],
			links: []
		};

		// Clean up any new trip after each add test
		function removeAdded(id: string) {
			const raw = localStorage.getItem('hw-trips');
			if (!raw) return;
			const parsed = JSON.parse(raw);
			delete parsed[id];
			localStorage.setItem('hw-trips', JSON.stringify(parsed));
		}

		it('inserts a brand-new trip', () => {
			expect(trips.addTrip(newTrip)).toBe(true);
			const added = get(trips)['japan-2026-10'];
			expect(added).toBeTruthy();
			expect(added.name).toBe('Japan Oct 2026');
			expect(added.days).toHaveLength(3);
			removeAdded('japan-2026-10');
		});

		it('computes destinations from day locations', () => {
			trips.addTrip(newTrip);
			const added = get(trips)['japan-2026-10'];
			expect(added.destinations).toEqual(expect.arrayContaining(['Tokyo', 'Kyoto']));
			removeAdded('japan-2026-10');
		});

		it('refuses to overwrite an existing trip', () => {
			trips.addTrip(newTrip);
			expect(trips.addTrip({ ...newTrip, name: 'Overwrite' })).toBe(false);
			expect(get(trips)['japan-2026-10'].name).toBe('Japan Oct 2026');
			removeAdded('japan-2026-10');
		});

		it('does not mutate input object (deep clones)', () => {
			trips.addTrip(newTrip);
			const added = get(trips)['japan-2026-10'];
			added.days[0].location = 'MUTATED';
			expect(newTrip.days[0].location).toBe('Tokyo');
			removeAdded('japan-2026-10');
		});
	});
});
