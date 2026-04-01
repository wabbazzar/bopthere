export interface Trip {
	year: number;
	destination: string;
	location: string;
	tagline: string;
	description: string;
	dates: string;
	crew: number;
	gradient: string;
	color: string;
	highlights: string[];
	isFeatured?: boolean;
}

export const trips: Trip[] = [
	{
		year: 2022,
		destination: 'The Beginning',
		location: 'First Adventure',
		tagline: 'Where our journey started',
		description: 'The inaugural birthday trip that started it all. Friends, laughter, and memories that would set the tone for years to come.',
		dates: 'TBD',
		crew: 6,
		gradient: 'from-amber-700 via-orange-600 to-yellow-500',
		color: '#D97706',
		highlights: ['First birthday trip together', 'Core crew established', 'Traditions born']
	},
	{
		year: 2023,
		destination: 'Chapter Two',
		location: 'The Sequel',
		tagline: 'New horizons, same spirit',
		description: 'Building on the magic of year one. The crew expanded and the adventures got bigger.',
		dates: 'TBD',
		crew: 8,
		gradient: 'from-purple-700 via-violet-600 to-fuchsia-500',
		color: '#7C3AED',
		highlights: ['Crew grows', 'New traditions', 'Epic moments']
	},
	{
		year: 2024,
		destination: 'The Journey',
		location: 'Uncharted Territory',
		tagline: 'Beyond the ordinary',
		description: 'Pushing boundaries and exploring new destinations. Every trip gets more ambitious.',
		dates: 'TBD',
		crew: 10,
		gradient: 'from-teal-700 via-cyan-600 to-emerald-500',
		color: '#0D9488',
		highlights: ['New destination', 'Adventure activities', 'Growing family']
	},
	{
		year: 2025,
		destination: 'Epic Tales',
		location: 'Legendary Grounds',
		tagline: 'Making history together',
		description: 'Another chapter in the chronicles. More friends, more places, more unforgettable moments.',
		dates: 'TBD',
		crew: 12,
		gradient: 'from-rose-700 via-red-600 to-orange-500',
		color: '#E11D48',
		highlights: ['Full crew assembled', 'Major celebration', 'Stories for days']
	},
	{
		year: 2026,
		destination: 'BANFF',
		location: 'Canadian Rockies',
		tagline: 'Mountains. Friends. Magic.',
		description: 'The crown jewel of birthday adventures. Twelve souls venture into the majestic Canadian Rockies for an unforgettable celebration among glacial lakes, towering peaks, and alpine wilderness.',
		dates: 'Coming Soon',
		crew: 12,
		gradient: 'from-sky-700 via-blue-600 to-indigo-500',
		color: '#0284C7',
		highlights: [
			'Lake Louise sunrise',
			'Moraine Lake hike',
			'Johnston Canyon',
			'Banff townsite',
			'Hot springs',
			'Wildlife spotting'
		],
		isFeatured: true
	}
];

export const featuredTrip = trips.find(t => t.isFeatured) || trips[trips.length - 1];

export function getTripByYear(year: number): Trip | undefined {
	return trips.find(t => t.year === year);
}
