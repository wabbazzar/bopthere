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
		ooo: false,
		mapLinks: [
			{ label: 'Airport to Hotel', from: 'Shanghai Pudong International Airport', to: 'Kimpton Qiantan Shanghai' }
		]
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
		ooo: true,
		mapLinks: [
			{ label: 'Hotel to Pudong Airport', from: 'Kimpton Qiantan Shanghai', to: 'Shanghai Pudong International Airport Terminal 2' },
			{ label: 'Jiangbei Airport to Hotel', from: 'Chongqing Jiangbei International Airport Terminal 3', to: 'Hyatt Regency Metropolitan Chongqing' }
		]
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
		ooo: true
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
		ooo: true,
		mapLinks: [
			{ label: 'Hotel to Train Station', from: 'Hyatt Regency Metropolitan Chongqing', to: 'Chongqing North Railway Station' },
			{ label: 'Station to Homestay', from: '\u5f20\u5bb6\u754c\u897f\u7ad9', to: 'Qishi Li Cave Homestay, Wulingyuan, Zhangjiajie' }
		]
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
		ooo: true,
		mapLinks: [
			{ label: 'Homestay to City Hotel', from: 'Qishi Li Cave Homestay, Wulingyuan, Zhangjiajie', to: 'Hampton by Hilton Zhangjiajie Tianmen Mountain' }
		]
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
		ooo: true,
		mapLinks: [
			{ label: 'Hotel to Hehua Airport', from: 'Hampton by Hilton Zhangjiajie Tianmen Mountain', to: 'Zhangjiajie Hehua International Airport' },
			{ label: 'Pudong Airport to Hotel', from: 'Shanghai Pudong International Airport Terminal 1', to: 'The Shanghai EDITION, 199 Nanjing Road East, Shanghai' }
		]
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
		ooo: false,
		mapLinks: [
			{ label: 'Hotel to Airport', from: 'The Shanghai EDITION, 199 Nanjing Road East, Shanghai', to: 'Shanghai Pudong International Airport' }
		]
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
	links: []
};
