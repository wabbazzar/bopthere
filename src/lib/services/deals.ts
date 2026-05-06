import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';

const API = PUBLIC_CHAT_API_URL;

function headers() {
	const token = getToken();
	return {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {})
	};
}

export interface Deal {
	id: number;
	sent_at: string;
	destination: string;
	country: string;
	depart_date: string;
	total_cost: number;
	summary: string;
	deal_json: string;
	reaction: string | null;
	feedback_note: string | null;
}

export interface AlertSettings {
	enabled: boolean;
	signal_number: string;
	home_airport: string;
}

export async function fetchDeals(): Promise<Deal[]> {
	const res = await fetch(`${API}/api/deals`, { headers: headers() });
	if (!res.ok) throw new Error('Failed to fetch deals');
	const data = await res.json();
	return data.deals;
}

export async function getAlertSettings(): Promise<AlertSettings> {
	const res = await fetch(`${API}/api/deals/alerts`, { headers: headers() });
	if (!res.ok) throw new Error('Failed to fetch alert settings');
	return await res.json();
}

export async function updateAlertSettings(settings: AlertSettings): Promise<void> {
	const res = await fetch(`${API}/api/deals/alerts`, {
		method: 'PUT',
		headers: headers(),
		body: JSON.stringify(settings)
	});
	if (!res.ok) throw new Error('Failed to update alert settings');
}
