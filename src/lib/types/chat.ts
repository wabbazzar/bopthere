export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
	user?: string;
}

export interface TripUpdate {
	dayIndex: number;
	field: 'morning' | 'afternoon' | 'evening' | 'travel' | 'accommodation' | 'notes' | 'location';
	value: string;
}

export interface MapLinksAction {
	dayIndex: number;
	mapLinks: import('$lib/types/trip').MapLink[];
}

export interface TripCreate {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	destinations?: string[];
	days?: Array<{
		date: string;
		location: string;
		travel?: string;
		morning?: string;
		afternoon?: string;
		evening?: string;
		accommodation?: string;
		notes?: string;
	}>;
}

export type SuggestionType = 'activity' | 'restaurant';
export type Vibe = string;

export interface SuggestionRequest {
	tripId: string;
	dayIndex: number;
	slot: 'morning' | 'afternoon' | 'evening';
	type: SuggestionType;
	vibe: Vibe;
}
