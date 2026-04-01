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

export interface Trip {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	destinations: string[];
	days: TripDay[];
	links: string[];
}
