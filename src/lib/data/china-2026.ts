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
		notes: '',
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
		notes: '',
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
		accommodation: 'Voco Chongqing',
		notes: '',
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
		accommodation: 'Voco Chongqing',
		notes: '',
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
		accommodation: 'Voco Chongqing',
		notes: '',
		ooo: true
	},
	{
		date: '2026-04-27',
		dayOfWeek: 'Mon',
		location: 'Chongqing',
		travel: 'Full Day',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'Voco Chongqing',
		notes: '',
		ooo: true
	},
	{
		date: '2026-04-28',
		dayOfWeek: 'Tue',
		location: 'Zhangjiajie',
		travel: 'Morning bullet train',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'Wulingyuan',
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
		accommodation: 'Wulingyuan',
		notes: '',
		ooo: true
	},
	{
		date: '2026-04-30',
		dayOfWeek: 'Thu',
		location: 'Zhangjiajie',
		travel: 'Late night from Zhangjiajie to SH 8:35PM',
		morning: '',
		afternoon: '',
		evening: '',
		accommodation: 'hotel',
		notes: '',
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
		accommodation: '24 hr spa',
		notes: '',
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

export const chinaTrip: Trip = {
	id: 'china-2026',
	name: 'China 2026',
	startDate: '2026-04-22',
	endDate: '2026-05-02',
	destinations: ['Shanghai', 'Chongqing', 'Zhangjiajie'],
	days,
	links: [
		'https://us.trip.com/hotels/detail/?hotelId=97132394&checkIn=2026-04-28&checkOut=2026-04-30&adult=2',
		'https://us.trip.com/hotels/zhangjiajie-hotel-detail-1766751/no-5-valley-inn/?cityId=27&checkIn=2026-04-28&checkOut=2026-04-30&adult=2'
	]
};
