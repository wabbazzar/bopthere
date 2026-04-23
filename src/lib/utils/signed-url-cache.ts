import { getSignedPhotoUrl } from '$lib/services/photo-upload';

interface CachedUrl {
	url: string;
	expiresAt: number;
}

const cache = new Map<string, CachedUrl>();
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh when <5 minutes remaining

function cacheKey(tripId: string, filename: string): string {
	return `${tripId}/${filename}`;
}

/**
 * Get a signed photo URL, using an in-memory cache to avoid redundant signing requests.
 * Returns the cached URL if it has >5 minutes remaining, otherwise fetches a new one.
 */
export async function getPhotoUrl(tripId: string, filename: string): Promise<string> {
	const key = cacheKey(tripId, filename);
	const cached = cache.get(key);

	if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
		return cached.url;
	}

	const url = await getSignedPhotoUrl(tripId, filename);
	// Signed URLs have 1-hour expiry
	cache.set(key, { url, expiresAt: Date.now() + 3600 * 1000 });
	return url;
}

/** Clear the cache (e.g., on logout). */
export function clearPhotoUrlCache() {
	cache.clear();
}
