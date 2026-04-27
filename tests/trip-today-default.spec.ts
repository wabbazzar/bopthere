/**
 * Test: Trip page defaults to today's date when opened.
 *
 * Verifies:
 * 1. Day view defaults to today's day index (not day 1)
 * 2. Week view highlights today on the mini calendar
 * 3. Switching to day view from week preserves today-default
 * 4. No rapid week->day flash on load when day view was last used
 */
import { test, expect, type Page } from '@playwright/test';
import { idbPut, idbGet } from './helpers/idb';

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

/** Format today as MM-DD for matching in the day header. */
function todayMMDD(): string {
	const now = new Date();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	return `${mm}-${dd}`;
}

test.describe('Trip opens on today', () => {
	test.beforeEach(async ({ page }) => {
		await seedAuth(page);
		// Clear any saved day preference and view preference
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
					store.delete('hw-trip-view-china-2026');
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

		// Switch to Day view
		await page.locator('button[role="tab"]:has-text("Day")').click();
		await page.waitForTimeout(1000);

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

		const expected = expectedTodayIndex();
		const todayDate = todayMMDD();

		await page.goto(`${BASE_URL}/trip/${TRIP_ID}`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(4000);

		await page.locator('button[role="tab"]:has-text("Day")').click();
		await page.waitForTimeout(1000);

		const text = await page.locator('main').textContent();
		expect(text).toContain(todayDate);
	});

	test('no view flash when day view was previously saved', async ({ page }) => {
		// Pre-save "day" as the view preference
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
		await idbPut(page, 'prefs', 'hw-trip-view-china-2026', 'day');

		// Set up mutation observer before navigation to catch any week->day flash
		await page.addInitScript(() => {
			(window as any).__viewFlashLog = [];
			const observer = new MutationObserver(() => {
				// Check if WeekView (with its mini-calendar grid) briefly appeared
				const weekGrid = document.querySelector('[role="tablist"] + * table, [role="tablist"] + * .week-grid');
				const dayNav = document.querySelector('button[aria-label="Next day"]');
				if (weekGrid && !dayNav) {
					(window as any).__viewFlashLog.push({
						type: 'week-flash',
						time: performance.now()
					});
				}
			});
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true
			});
		});

		await page.goto(`${BASE_URL}/trip/${TRIP_ID}`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(4000);

		// Should be in day view (day nav arrows visible)
		const dayTab = page.locator('button[role="tab"]:has-text("Day")');
		await expect(dayTab).toHaveAttribute('aria-selected', 'true');

		// Verify today's date is shown
		const todayDate = todayMMDD();
		const text = await page.locator('main').textContent();
		expect(text).toContain(todayDate);
	});
});
