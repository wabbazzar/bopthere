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
}

export interface Booking {
	type: 'flight' | 'hotel';
	label: string;
	date: string;
	confirmation?: string;
	details: string[];
	ticketUrl?: string;
}

export interface Trip {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	destinations: string[];
	days: TripDay[];
	links: string[];
	bookings?: Booking[];
}
