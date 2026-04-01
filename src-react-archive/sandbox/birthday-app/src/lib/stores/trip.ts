import { writable, derived } from 'svelte/store';
import { currentTrip } from '$lib/data/trips';

export const trip = writable(currentTrip);

export const confirmedGuests = derived(trip, ($trip) =>
	$trip.guests.filter((g) => g.status === 'confirmed')
);

export const pendingGuests = derived(trip, ($trip) =>
	$trip.guests.filter((g) => g.status === 'pending')
);

export const totalDays = derived(trip, ($trip) => $trip.days.length);

export const countdown = derived(trip, ($trip) => {
	const start = new Date($trip.startDate + 'T00:00:00');
	const now = new Date();
	const diff = start.getTime() - now.getTime();
	const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
	return Math.max(0, days);
});
