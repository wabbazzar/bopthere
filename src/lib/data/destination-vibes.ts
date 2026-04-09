export interface DestinationProfile {
	defaultInterest: string;
	knownFor: string[];
}

export const destinationProfiles: Record<string, DestinationProfile> = {
	Shanghai: {
		defaultInterest: 'culture',
		knownFor: [
			'The Bund waterfront',
			'French Concession neighborhood',
			'Yuyuan Garden',
			'soup dumplings (xiaolongbao)',
			"Jing'an Temple",
			'Nanjing Road shopping',
			'Pudong skyline views',
			'art deco architecture'
		]
	},
	Chongqing: {
		defaultInterest: 'food',
		knownFor: [
			'hotpot capital of China',
			'Hongya Cave (illuminated cliff buildings)',
			'Ciqikou Ancient Town',
			'Yangtze River views',
			'spicy street food and noodles',
			'mountain city terrain and monorails',
			'Jiefangbei pedestrian square'
		]
	},
	Zhangjiajie: {
		defaultInterest: 'nature',
		knownFor: [
			'Avatar-inspiration sandstone pillars',
			'Zhangjiajie National Forest Park',
			'Zhangjiajie Glass Bridge',
			'Tianmen Mountain and sky walk',
			'Wulingyuan scenic area',
			'Baofeng Lake',
			'Golden Whip Stream hiking'
		]
	}
};

export function getProfile(location: string): DestinationProfile {
	// Try exact match, then partial match
	if (destinationProfiles[location]) return destinationProfiles[location];
	const key = Object.keys(destinationProfiles).find((k) =>
		location.toLowerCase().includes(k.toLowerCase())
	);
	return key
		? destinationProfiles[key]
		: { defaultInterest: 'culture', knownFor: [] };
}
