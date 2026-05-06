import { test, expect, type Page } from '@playwright/test';
import { idbGet, idbPut, idbGetTripDay } from './helpers/idb';

const BASE_URL = 'http://localhost:5174';

const TEST_USER = {
	username: 'wesley',
	email: 'wesleybeckner@gmail.com',
	full_name: 'Wesley Beckner',
	role: 'admin'
};

async function injectAuth(page: Page) {
	await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
	await page.evaluate(async (user) => {
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
		localStorage.removeItem('hw-idb-migration-complete');
		localStorage.setItem('hw-auth-token', jwt);
		localStorage.setItem('hw-auth-user', JSON.stringify(user));
	}, TEST_USER);
}

async function openDayView(page: Page) {
	// Block real trips API so the store uses only IDB-seeded data
	await page.route('**/api/trips/**', async (route) => {
		await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
	});
	await injectAuth(page);

	// Seed a minimal single-day trip into IndexedDB (the app reads IDB, not localStorage)
	// Use today's date so todayDayIndex() lands on day 0
	const today = new Date().toISOString().slice(0, 10);
	const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
	const minimalDay = {
		date: today, dayOfWeek: dow, location: 'Shanghai',
		travel: '', morning: '', afternoon: '', evening: '',
		accommodation: '', notes: '', ooo: false, mapLinks: []
	};
	const minimalMeta = {
		name: 'China 2026 Test', startDate: today, endDate: today,
		destinations: ['Shanghai'], links: []
	};
	await idbPut(page, 'trips', 'trip-meta:china-2026', minimalMeta);
	await idbPut(page, 'trips', 'trip-day:china-2026:0', minimalDay);
	// Ensure IDB writes are committed before navigation
	await page.waitForTimeout(200);

	await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1', { timeout: 10000 });
	// Wait for the store to hydrate from IDB and render the day card
	await page.waitForTimeout(1000);
	// Switch to Day view
	const dayTab = page.getByRole('tab', { name: 'Day' });
	if (await dayTab.isVisible().catch(() => false)) {
		await dayTab.click();
	}
	// Wait for day card fields to render (not just the header)
	await page.waitForSelector('[title="Tap to edit"], button[aria-label="Add directions link"]', { timeout: 10000 });
}

test.describe('MapLinks editor', () => {
	test('Add a map link via the GUI and see it persist', async ({ page }) => {
		await openDayView(page);

		const addBtn = page.locator('button[aria-label="Add directions link"]');
		await expect(addBtn).toBeVisible();
		await addBtn.click();

		await page.locator('input[aria-label="Label"]').fill('Hotel to Airport');
		await page.locator('input[aria-label="From"]').fill('Grand Hyatt Shanghai');
		await page.locator('input[aria-label="To"]').fill('PVG Airport');

		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();

		// The new link renders
		await expect(page.locator('text=Hotel to Airport').first()).toBeVisible();
		await expect(page.locator('text=Grand Hyatt Shanghai → PVG Airport').first()).toBeVisible();

		// Persisted to IndexedDB
		const day = await idbGetTripDay(page, 'china-2026', 0);
		const stored = day?.mapLinks ?? [];
		expect(stored).toHaveLength(1);
		expect(stored[0]).toEqual({
			label: 'Hotel to Airport',
			from: 'Grand Hyatt Shanghai',
			to: 'PVG Airport'
		});
	});

	test('Edit an existing map link', async ({ page }) => {
		await openDayView(page);

		// Seed one link
		await page.locator('button[aria-label="Add directions link"]').click();
		await page.locator('input[aria-label="Label"]').fill('A to B');
		await page.locator('input[aria-label="From"]').fill('A');
		await page.locator('input[aria-label="To"]').fill('B');
		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();
		await expect(page.locator('text=A to B').first()).toBeVisible();

		// Edit it
		await page.locator('button[aria-label="Edit A to B"]').click();
		const labelInput = page.locator('input[aria-label="Label"]');
		await labelInput.fill('A to C');
		await page.locator('input[aria-label="To"]').fill('C');
		await page.locator('button[type="submit"]', { hasText: 'Save' }).click();

		await expect(page.locator('text=A to C').first()).toBeVisible();
		const day2 = await idbGetTripDay(page, 'china-2026', 0);
		expect(day2?.mapLinks).toEqual([{ label: 'A to C', from: 'A', to: 'C' }]);
	});

	test('Delete a map link', async ({ page }) => {
		await openDayView(page);

		await page.locator('button[aria-label="Add directions link"]').click();
		await page.locator('input[aria-label="Label"]').fill('Doomed Route');
		await page.locator('input[aria-label="From"]').fill('X');
		await page.locator('input[aria-label="To"]').fill('Y');
		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();
		await expect(page.locator('text=Doomed Route').first()).toBeVisible();

		await page.locator('button[aria-label="Delete Doomed Route"]').click();
		await expect(page.locator('text=Doomed Route')).not.toBeVisible();

		const trip3 = await idbGet(page, 'trips', 'china-2026');
		expect(trip3.days[0].mapLinks).toEqual([]);
	});

	test('New link auto-chains "from" to prior link\'s "to"', async ({ page }) => {
		await openDayView(page);

		// First link
		await page.locator('button[aria-label="Add directions link"]').click();
		await page.locator('input[aria-label="Label"]').fill('Stop 1');
		await page.locator('input[aria-label="From"]').fill('Place A');
		await page.locator('input[aria-label="To"]').fill('Place B');
		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();

		// Second — From should default to "Place B"
		await page.locator('button[aria-label="Add directions link"]').click();
		const fromInput = page.locator('input[aria-label="From"]');
		await expect(fromInput).toHaveValue('Place B');
	});
});
