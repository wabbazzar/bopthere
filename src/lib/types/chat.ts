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

export type TripDayOp =
	| { op: 'add'; afterIndex?: number }
	| { op: 'delete'; dayIndex: number }
	| { op: 'duplicate'; dayIndex: number }
	| { op: 'move'; dayIndex: number; direction: 'up' | 'down' };

export interface TripMetaAction {
	name?: string;
	startDate?: string;
	endDate?: string;
	destinations?: string[];
}

export type TripLinkOp =
	| { op: 'add'; url: string }
	| { op: 'update'; linkIndex: number; url: string }
	| { op: 'delete'; linkIndex: number };

export type TodoOp =
	| { op: 'add'; text: string }
	| { op: 'update'; todoIndex: number; text: string }
	| { op: 'toggle'; todoIndex: number }
	| { op: 'delete'; todoIndex: number };

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

export interface TourScriptAction {
	dayIndex: number;
	title: string;
	content: string;
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
