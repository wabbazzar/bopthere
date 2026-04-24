export type MapProvider = 'google' | 'apple';

export interface MapLink {
	label: string;
	from: string;
	to: string;
	provider?: MapProvider;
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
	version?: number;
}

export interface Booking {
	type: 'flight' | 'hotel' | 'train';
	label: string;
	date: string;
	confirmation?: string;
	details: string[];
	ticketUrl?: string | string[];
	bookingUrl?: string;
	id?: string;
	version?: number;
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

// ── Block-based journal editor ────────────────────────────────

export interface JournalTextBlock {
	id: string;
	type: 'text';
	content: string;
}

export interface JournalPhotoBlock {
	id: string;
	type: 'photo';
	photoId: string;
	caption: string;
	uploadedBy: string;
	/** Transient: local blob URL for immediate preview before upload completes */
	_localObjectUrl?: string;
	/** Transient: upload state (not persisted) */
	_uploadPending?: boolean;
}

export type JournalBlock = JournalTextBlock | JournalPhotoBlock;

export interface JournalEntry {
	dayIndex: number;
	date: string;
	location: string;
	blocks: JournalBlock[];
	/** @deprecated Legacy field — migrated to blocks on load */
	body?: string;
	/** @deprecated Legacy field — migrated to blocks on load */
	photos?: JournalPhoto[];
	itinerary: ItineraryCheckItem[];
	mood?: 'great' | 'good' | 'okay' | 'tough';
	weather?: string;
	createdAt: string;
	updatedAt: string;
	version?: number;
}

// ── Todos ────────────────────────────────────────────────────

export interface Todo {
	text: string;
	done: boolean;
	id?: string;
	version?: number;
}
