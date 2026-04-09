import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';
import type { Trip } from '$lib/types/trip';
import type { ChatMessage } from '$lib/types/chat';

const API_URL = PUBLIC_CHAT_API_URL;

function headers(): Record<string, string> {
	const token = getToken();
	return {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {})
	};
}

export async function getConversation(tripId: string): Promise<ChatMessage[]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(`${API_URL}/api/chat/conversations/${tripId}`, {
			headers: headers(),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (!res.ok) throw new Error('Failed to load conversation');
		const data = await res.json();
		return data.messages || [];
	} catch (e) {
		clearTimeout(timeout);
		throw e;
	}
}

export async function sendMessage(tripId: string, trip: Trip, message: string): Promise<ChatMessage> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 60000);
	try {
		const res = await fetch(`${API_URL}/api/chat/messages`, {
			method: 'POST',
			headers: headers(),
			signal: controller.signal,
			body: JSON.stringify({
				tripId,
				message,
				systemPrompt: buildSystemPrompt(trip)
			})
		});
		clearTimeout(timeout);
		if (!res.ok) {
			const err = await res.json().catch(() => ({ detail: 'Chat request failed' }));
			throw new Error(err.detail || 'Chat request failed');
		}
		return await res.json();
	} catch (e) {
		clearTimeout(timeout);
		throw e;
	}
}

export async function clearConversation(tripId: string): Promise<void> {
	await fetch(`${API_URL}/api/chat/conversations/${tripId}`, {
		method: 'DELETE',
		headers: headers()
	});
}

function buildSystemPrompt(trip: Trip): string {
	const today = new Date().toISOString().split('T')[0];

	const daysSummary = trip.days
		.map((d, i) => {
			const parts = [`Day ${i + 1}: ${d.dayOfWeek} ${d.date} — ${d.location}`];
			if (d.travel) parts.push(`  Travel: ${d.travel}`);
			if (d.accommodation) parts.push(`  Stay: ${d.accommodation}`);
			if (d.morning) parts.push(`  AM: ${d.morning}`);
			if (d.afternoon) parts.push(`  PM: ${d.afternoon}`);
			if (d.evening) parts.push(`  EVE: ${d.evening}`);
			if (d.notes) parts.push(`  Notes: ${d.notes}`);
			if (d.ooo) parts.push(`  [Wesley working remotely]`);
			return parts.join('\n');
		})
		.join('\n\n');

	const bookingsSummary = (trip.bookings || [])
		.map((b) => {
			const conf = b.confirmation ? ` — Conf: ${b.confirmation}` : '';
			return `${b.type.toUpperCase()}: ${b.label} (${b.date})${conf}\n  ${b.details.join(', ')}`;
		})
		.join('\n');

	return `You are a travel planning assistant for Wesley and Heather's trip.
Today: ${today}
Trip: ${trip.name} (${trip.startDate} to ${trip.endDate})
Destinations: ${trip.destinations.join(', ')}

ITINERARY:
${daysSummary}

BOOKINGS:
${bookingsSummary}

Guidelines:
- Suggest specific places with names, not generic advice
- Consider the location for each day
- Be aware of travel days vs full days
- Note days where Wesley is working remotely (Heather may explore solo)
- Keep suggestions concise and actionable
- For restaurants, include cuisine type and price range
- Consider proximity to their accommodation for each day
- Use markdown formatting sparingly (bold for names is fine)`;
}
