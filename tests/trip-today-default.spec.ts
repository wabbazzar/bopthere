/**
 * Test: Trip page defaults to today's date when opened.
 *
 * Verifies:
 * 1. Day view defaults to today's day index (not day 1)
 * 2. Stale prefs don't override today-default
 */
import { test, expect, type Page } from '@playwright/test';
import { idbPut } from './helpers/idb';

const BASE_URL = 'http://localhost:5174';
const TRIP_ID = 'china-2026';
const TRIP_START = '2026-04-22'; // China trip starts Apr 22

/** Inject auth into IndexedDB so the app loads authenticated. */
async function seedAuth(page: Page) {
	await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
	await page.evaluate(async () => {
		const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const payload = btoa(JSON.stringify({
			username: 'wesley', role: 'admin',
			exp: Math.floor(Date.now() / 1000) + 86400
		})).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const enc = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw', enc.encode('your-secret-key-change-in-production'),
			{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
		);
		const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${payload}`));
		const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const jwt = `${header}.${payload}.${signature}`;

		// Seed auth via localStorage so the migration picks it up
		localStorage.removeItem('hw-idb-migration-complete');
		localStorage.setItem('hw-auth-token', jwt);
		localStorage.setItem('hw-auth-user', JSON.stringify({
			username: 'wesley', email: 'w@w.com', full_name: 'Wesley', role: 'admin'
		}));
	});
}

/** Compute expected day index for today within the trip. */
function expectedTodayIndex(): number {
	const start = new Date(TRIP_START + 'T00:00:00');
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
	// Trip has 12 days (Apr 22 - May 3)
	return Math.max(0, Math.min(diff, 11));
}

/** Format the expected trip date as MM-DD for matching in the day header.
 * When today is past the trip end, the app shows the last trip day, not today. */
function todayMMDD(): string {
	const start = new Date(TRIP_START + 'T00:00:00');
	const idx = expectedTodayIndex();
	const tripDate = new Date(start.getTime() + idx * 86_400_000);
	const mm = String(tripDate.getMonth() + 1).padStart(2, '0');
	const dd = String(tripDate.getDate()).padStart(2, '0');
	return `${mm}-${dd}`;
}

test.describe('Trip opens on today', () => {
	test.beforeEach(async ({ page }) => {
		await seedAuth(page);
		// Clear any saved day preference
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
		await page.evaluate(() => {
			return new Promise<void>((resolve, reject) => {
				const req = indexedDB.open('hw-travel', 2);
				req.onupgradeneeded = (event) => {
					const db = (event.target as IDBOpenDBRequest).result;
					for (const name of ['auth', 'trips', 'journal', 'todos', 'meta', 'prefs', 'scripts']) {
						if (!db.objectStoreNames.contains(name)) {
							db.createObjectStore(name, { keyPath: 'key' });
						}
					}
				};
				req.onsuccess = () => {
					const db = req.result;
					const tx = db.transaction('prefs', 'readwrite');
					const store = tx.objectStore('prefs');
					store.delete('hw-trip-day-china-2026');
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
				};
				req.onerror = () => reject(req.error);
			});
		});
	});

	test('day view defaults to today, not day 1', async ({ page }) => {
		const expected = expectedTodayIndex();
		const todayDate = todayMMDD();

		await page.goto(`${BASE_URL}/trip/${TRIP_ID}`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(4000);

		// Day view is now the only view — day nav arrows should be visible
		await expect(page.locator('button[aria-label="Next day"]')).toBeVisible({ timeout: 5000 });

		// The day header should show today's date (e.g. "SUN 04-27")
		const dayHeader = page.locator('main');
		const text = await dayHeader.textContent();
		expect(text).toContain(todayDate);

		// Day N of 12 should match expected index + 1
		const dayNumPattern = new RegExp(`Day ${expected + 1} of`, 'i');
		await expect(dayHeader).toContainText(dayNumPattern);
	});

	test('day view still defaults to today even with stale pref from prior visit', async ({ page }) => {
		// Simulate a prior visit that saved day 0 (stale pref that should be ignored)
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
		await idbPut(page, 'prefs', 'hw-trip-day-china-2026', '0');

		const todayDate = todayMMDD();

		await page.goto(`${BASE_URL}/trip/${TRIP_ID}`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(4000);

		await expect(page.locator('button[aria-label="Next day"]')).toBeVisible({ timeout: 5000 });

		const text = await page.locator('main').textContent();
		expect(text).toContain(todayDate);
	});
});
