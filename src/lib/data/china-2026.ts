import type { Trip, TripDay } from '$lib/types/trip';

const days: TripDay[] = [
	{
		date: '2026-04-22',
		dayOfWeek: 'Wed',
		location: 'Shanghai',
		travel: 'Land at 5PM',
		morning: '',
		afternoon: '',
		evening: 'Check in hotel, explore city',
		accommodation: 'Kimpton IHG',
		notes: '$35/night post credits, free breakfast',
		ooo: false
	},
	{
		date: '2026-04-23',
		dayOfWeek: 'Thu',
		location: 'Shanghai',
		travel: 'Full Day',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'Kimpton IHG',
		notes: '$35/night post credits, free breakfast',
		ooo: true
	},
	{
		date: '2026-04-24',
		dayOfWeek: 'Fri',
		location: 'Chongqing',
		travel: '9am Flight to Chongqing, land 12pm',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'Hyatt Regency Metro',
		notes: '8K points, $0',
		ooo: false
	},
	{
		date: '2026-04-25',
		dayOfWeek: 'Sat',
		location: 'Chongqing',
		travel: 'Full Day',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'Hyatt Regency Metro',
		notes: '8K points, $0',
		ooo: false
	},
	{
		date: '2026-04-26',
		dayOfWeek: 'Sun',
		location: 'Chongqing',
		travel: 'Full Day',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'Hyatt Regency Metro',
		notes: '8K points, $0',
		ooo: true
	},
	{
		date: '2026-04-27',
		dayOfWeek: 'Mon',
		location: 'Zhangjiajie',
		travel: 'Half Day CQ / Half Day ZJJ',
		morning: '',
		afternoon: 'Bullet Train over to ZJJ',
		evening: 'Check in hotel',
		accommodation: 'Qishi Li Cave Homestay',
		notes: 'Near National Forest Park',
		ooo: true
	},
	{
		date: '2026-04-28',
		dayOfWeek: 'Tue',
		location: 'Zhangjiajie',
		travel: '',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'Qishi Li Cave Homestay',
		notes: '',
		ooo: true
	},
	{
		date: '2026-04-29',
		dayOfWeek: 'Wed',
		location: 'Zhangjiajie',
		travel: 'Full Day',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'ZJJ City Hotel (TBD)',
		notes: 'Hampton by Hilton recommended',
		ooo: true
	},
	{
		date: '2026-04-30',
		dayOfWeek: 'Thu',
		location: 'Zhangjiajie / Shanghai',
		travel: 'Late night ZJJ to SH 8:35PM',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'The Shanghai EDITION',
		notes: '16K points, $0',
		ooo: true
	},
	{
		date: '2026-05-01',
		dayOfWeek: 'Fri',
		location: 'Shanghai',
		travel: 'Full Day',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'The Shanghai EDITION',
		notes: '16K points, $0',
		ooo: false
	},
	{
		date: '2026-05-02',
		dayOfWeek: 'Sat',
		location: 'Shanghai',
		travel: 'Fly back to US at 12PM',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: '',
		notes: 'Travel Back',
		ooo: false
	}
];

// bookings removed from git history

export const chinaTrip: Trip = {
	id: 'china-2026',
	name: 'China 2026',
	startDate: '2026-04-22',
	endDate: '2026-05-02',
	destinations: ['Shanghai', 'Chongqing', 'Zhangjiajie'],
	days
	links: [
		'https://www.hyatt.com/shop/rooms/ckgro?location=Hyatt+Regency+Metropolitan+Chongqing&checkinDate=2026-04-24&checkoutDate=2026-04-27&rooms=1&adults=2',
		'https://www.hilton.com/en/book/reservation/rooms/?ctyhocn=DYGZAHX&arrivalDate=2026-04-29&departureDate=2026-04-30&room1NumAdults=2'
	]
};
