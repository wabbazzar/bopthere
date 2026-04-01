export interface Guest {
	id: string;
	name: string;
	status: 'confirmed' | 'pending' | 'declined';
	emoji: string;
}

export interface Activity {
	id: string;
	time: string;
	title: string;
	description: string;
	icon: string;
}

export interface TripDay {
	date: string;
	label: string;
	highlight?: string;
	activities: Activity[];
}

export interface Trip {
	id: string;
	year: number;
	title: string;
	destination: string;
	dates: string;
	startDate: string;
	endDate: string;
	coverGradient: string;
	guests: Guest[];
	days: TripDay[];
}

export const currentTrip: Trip = {
	id: 'sept-2026',
	year: 2026,
	title: 'The Birthday Trip',
	destination: 'TBD',
	dates: 'September 5 - 9',
	startDate: '2026-09-05',
	endDate: '2026-09-09',
	coverGradient: 'from-amber-500/20 via-rose-500/10 to-sky-500/20',
	guests: [
		{ id: '1', name: 'Wesley', status: 'confirmed', emoji: '🎂' },
		{ id: '2', name: 'Heather', status: 'confirmed', emoji: '🎂' },
		{ id: '3', name: 'Marcus & Lena', status: 'confirmed', emoji: '✈️' },
		{ id: '4', name: 'Jordan', status: 'pending', emoji: '🤔' },
		{ id: '5', name: 'Sam & Alex', status: 'pending', emoji: '💬' },
		{ id: '6', name: 'Taylor', status: 'confirmed', emoji: '🎉' },
		{ id: '7', name: 'Riley', status: 'declined', emoji: '😢' }
	],
	days: [
		{
			date: '2026-09-05',
			label: 'Saturday',
			activities: [
				{
					id: 'a1',
					time: 'Afternoon',
					title: 'Arrivals',
					description: 'Everyone lands and settles in',
					icon: '✈️'
				},
				{
					id: 'a2',
					time: 'Evening',
					title: 'Welcome Dinner',
					description: 'First night together, casual vibes',
					icon: '🍽️'
				}
			]
		},
		{
			date: '2026-09-06',
			label: 'Sunday',
			activities: [
				{
					id: 'a3',
					time: 'Morning',
					title: 'Group Activity',
					description: 'TBD adventure',
					icon: '🏄'
				},
				{
					id: 'a4',
					time: 'Afternoon',
					title: 'Free Time',
					description: 'Explore, relax, do your thing',
					icon: '☀️'
				},
				{
					id: 'a5',
					time: 'Evening',
					title: 'Game Night',
					description: 'Birthday trip tradition',
					icon: '🎮'
				}
			]
		},
		{
			date: '2026-09-07',
			label: 'Monday',
			highlight: "Wesley's Birthday",
			activities: [
				{
					id: 'a6',
					time: 'Morning',
					title: 'Birthday Brunch',
					description: "Wesley's pick",
					icon: '🥞'
				},
				{
					id: 'a7',
					time: 'Afternoon',
					title: "Birthday Person's Choice",
					description: 'Wesley picks the adventure',
					icon: '🎯'
				},
				{
					id: 'a8',
					time: 'Evening',
					title: 'Birthday Dinner',
					description: 'Celebrating Wesley',
					icon: '🎂'
				}
			]
		},
		{
			date: '2026-09-08',
			label: 'Tuesday',
			highlight: "Heather's Birthday",
			activities: [
				{
					id: 'a9',
					time: 'Morning',
					title: 'Birthday Brunch',
					description: "Heather's pick",
					icon: '🧁'
				},
				{
					id: 'a10',
					time: 'Afternoon',
					title: "Birthday Person's Choice",
					description: 'Heather picks the adventure',
					icon: '💫'
				},
				{
					id: 'a11',
					time: 'Evening',
					title: 'Birthday Dinner',
					description: 'Celebrating Heather',
					icon: '🎂'
				}
			]
		},
		{
			date: '2026-09-09',
			label: 'Wednesday',
			activities: [
				{
					id: 'a12',
					time: 'Morning',
					title: 'Last Morning',
					description: 'Final breakfast together',
					icon: '☕'
				},
				{
					id: 'a13',
					time: 'Afternoon',
					title: 'Departures',
					description: 'Until next year',
					icon: '👋'
				}
			]
		}
	]
};
