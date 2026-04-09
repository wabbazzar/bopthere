import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';
import type { Trip } from '$lib/types/trip';
import type { ChatMessage } from '$lib/types/chat';
import { getProfile } from '$lib/data/destination-vibes';

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
			if (d.ooo) parts.push(`  [Heather OOO]`);
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
- Consider the location for each day when suggesting
- Be aware of travel days vs full days
- Keep suggestions concise and actionable
- For restaurants, include cuisine type and price range (local currency + USD)
- For activities, include entry fee if any and how to get there
- Consider proximity to their accommodation
- Use markdown formatting sparingly (bold for names is fine)

When giving activity/restaurant suggestions:
- Give exactly 2-3 specific options
- For each: name, 1-sentence why it fits, estimated time needed
- Include a search link: [Reviews](https://www.google.com/search?q=PLACE+NAME+CITY+reviews)
- Be opinionated — rank with a clear #1 pick

UPDATING THE TRIP:
When the user asks you to add, change, or fill in trip details (e.g. "put Din Tai Fung in the evening slot for day 3", "change the hotel on day 5"), include a TRIP_UPDATE block at the END of your response. The block MUST be valid JSON wrapped in triple-backtick fences:

\`\`\`TRIP_UPDATE
[{"dayIndex": 2, "field": "evening", "value": "Din Tai Fung — soup dumplings, walk from hotel"}]
\`\`\`

Rules:
- dayIndex is 0-based (Day 1 = index 0)
- field must be one of: morning, afternoon, evening, travel, accommodation, notes, location
- value is always a string
- You may include multiple updates in one array
- Always explain what you're updating in plain text BEFORE the block
- If the user's request is ambiguous (which day? which slot?), ASK — don't guess
- Never emit a TRIP_UPDATE unless the user explicitly asks to change the itinerary`;
}

export function buildSuggestionMessage(
	trip: Trip,
	dayIndex: number,
	slot: 'morning' | 'afternoon' | 'evening',
	energy: string,
	interest: string
): string {
	const day = trip.days[dayIndex];
	if (!day) return '';

	const profile = getProfile(day.location);
	const knownFor = profile.knownFor.length ? `\nThis area is known for: ${profile.knownFor.join(', ')}.` : '';

	// Build adjacent activity context
	const adjacent: string[] = [];
	if (slot !== 'morning' && day.morning) adjacent.push(`Morning: ${day.morning}`);
	if (slot !== 'afternoon') {
		if (day.morning && slot === 'evening') adjacent.push(`Morning: ${day.morning}`);
		if (day.afternoon) adjacent.push(`Afternoon: ${day.afternoon}`);
	}
	if (slot !== 'evening' && day.evening) adjacent.push(`Evening: ${day.evening}`);
	if (day.travel) adjacent.push(`Travel: ${day.travel}`);
	const adjacentCtx = adjacent.length ? `\nAlready planned: ${adjacent.join('; ')}.` : '';

	return `Suggest 2-3 ${slot} options for ${day.dayOfWeek} ${day.date} in ${day.location}.
Vibe: ${energy} energy, ${interest} focus.${knownFor}${adjacentCtx}
Include review links for each suggestion.`;
}
