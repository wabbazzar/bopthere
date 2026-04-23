import { PUBLIC_CHAT_API_URL } from '$env/static/public';
import { getToken } from '$lib/services/auth';

const API_URL = PUBLIC_CHAT_API_URL;

function authHeaders(): Record<string, string> {
	const token = getToken();
	return {
		...(token ? { Authorization: `Bearer ${token}` } : {})
	};
}

export async function uploadPhoto(
	tripId: string,
	file: File
): Promise<{ photoId: string; filename: string }> {
	const formData = new FormData();
	formData.append('photo', file);

	const res = await fetch(`${API_URL}/api/trips/${tripId}/photos`, {
		method: 'POST',
		headers: authHeaders(),
		body: formData
	});

	if (res.status === 413) {
		const data = await res.json();
		throw new Error(data.detail || 'Photo too large');
	}
	if (!res.ok) {
		throw new Error(`Upload failed (${res.status})`);
	}

	return res.json();
}

export async function getSignedPhotoUrl(tripId: string, filename: string): Promise<string> {
	const res = await fetch(`${API_URL}/api/trips/${tripId}/photos/sign`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders()
		},
		body: JSON.stringify({ name: filename })
	});

	if (!res.ok) {
		throw new Error(`Failed to sign photo URL (${res.status})`);
	}

	const data = await res.json();
	// The signed URL is relative — prepend the API base
	return `${API_URL}${data.url}`;
}
