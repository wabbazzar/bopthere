export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
	user?: string;
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
