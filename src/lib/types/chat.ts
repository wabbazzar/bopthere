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

export type SuggestionType = 'activity' | 'restaurant';
export type Vibe = string;

export interface SuggestionRequest {
	tripId: string;
	dayIndex: number;
	slot: 'morning' | 'afternoon' | 'evening';
	type: SuggestionType;
	vibe: Vibe;
}
