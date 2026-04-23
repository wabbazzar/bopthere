export interface MapLink {
	label: string;
	from: string;
	to: string;
}

export interface TripDay {
	date: string;
	dayOfWeek: string;
	location: string;
	travel: string;
	morning: string;
	afternoon: string;
	evening: string;
	accommodation: string;
	notes: string;
	ooo: boolean;
	mapLinks?: MapLink[];
}

export interface Booking {
	type: 'flight' | 'hotel' | 'train';
	label: string;
	date: string;
	confirmation?: string;
	details: string[];
	ticketUrl?: string | string[];
	bookingUrl?: string;
}

export interface Trip {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	destinations: string[];
	days: TripDay[];
	links: string[];
}

// ── Journal ────────────────────────────────────────────────────

export interface ItineraryCheckItem {
	slot: 'travel' | 'morning' | 'afternoon' | 'evening';
	text: string;
	done: boolean;
	notes?: string;
}

export interface JournalPhoto {
	id: string;
	url: string;
	caption: string;
	timestamp?: string;
	slot?: 'travel' | 'morning' | 'afternoon' | 'evening';
}

export interface JournalEntry {
	dayIndex: number;
	date: string;
	location: string;
	body: string;
	itinerary: ItineraryCheckItem[];
	photos: JournalPhoto[];
	mood?: 'great' | 'good' | 'okay' | 'tough';
	weather?: string;
	createdAt: string;
	updatedAt: string;
}
