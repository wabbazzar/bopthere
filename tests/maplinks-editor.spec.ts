import { test, expect, type Page } from '@playwright/test';
import { idbGet, idbGetTripDay } from './helpers/idb';
import * as crypto from 'crypto';

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
	await injectAuth(page);

	// Navigate to the trip page first — the app will load the real china-2026
	// from the server (which has 12 days). Then switch to day view on day 1.
	await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1', { timeout: 10000 });
	// Wait for server data to arrive
	await page.waitForLoadState('networkidle');
	// Switch to Day view, go to day 1 (which has mapLinks: [])
	const dayTab = page.getByRole('tab', { name: 'Day' });
	if (await dayTab.isVisible().catch(() => false)) {
		await dayTab.click();
	}
	await page.waitForSelector('button[aria-label="Next day"]', { timeout: 5000 });
	// Navigate to day 1 explicitly (avoids today-default landing on last day)
	await page.locator('button[aria-label="Go to day 1"]').click();
	await page.waitForTimeout(300);
	await page.waitForSelector('button[aria-label="Add directions link"]', { timeout: 5000 });
}

const API = 'https://api.bopthere.com';

function forgeToken(): string {
	const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const p = Buffer.from(JSON.stringify({ username: 'wesley', role: 'admin', exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
	const s = crypto.createHmac('sha256', 'your-secret-key-change-in-production').update(`${h}.${p}`).digest('base64url');
	return `${h}.${p}.${s}`;
}

test.describe('MapLinks editor', () => {
	let _token: string;
	let _day0Snapshot: unknown;

	test.beforeAll(async () => {
		_token = forgeToken();
		const res = await fetch(`${API}/api/trips/china-2026/days/0`, {
			headers: { Authorization: `Bearer ${_token}` }
		});
		if (res.ok) _day0Snapshot = (await res.json()).day;
	});

	test.afterAll(async () => {
		if (!_token || !_day0Snapshot) return;
		const cur = await fetch(`${API}/api/trips/china-2026/days/0`, {
			headers: { Authorization: `Bearer ${_token}` }
		});
		if (!cur.ok) return;
		const { version } = await cur.json();
		await fetch(`${API}/api/trips/china-2026/days/0`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
			body: JSON.stringify({ day: _day0Snapshot, version })
		});
	});
	test('Add a map link via the GUI and see it persist', async ({ page }) => {
		await openDayView(page);

		// Count existing links before adding
		const dayBefore = await idbGetTripDay(page, 'china-2026', 0);
		const countBefore = (dayBefore?.mapLinks ?? []).length;

		const addBtn = page.locator('button[aria-label="Add directions link"]');
		await expect(addBtn).toBeVisible();
		await addBtn.click();

		await page.locator('input[aria-label="Label"]').fill('Test Route ABC');
		await page.locator('input[aria-label="From"]').fill('Place X');
		await page.locator('input[aria-label="To"]').fill('Place Y');

		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();

		// The new link renders
		await expect(page.locator('text=Test Route ABC').first()).toBeVisible();
		await expect(page.locator('text=Place X → Place Y').first()).toBeVisible();

		// Persisted to IndexedDB — count increased by 1
		const dayAfter = await idbGetTripDay(page, 'china-2026', 0);
		const stored = dayAfter?.mapLinks ?? [];
		expect(stored).toHaveLength(countBefore + 1);
		expect(stored[stored.length - 1]).toEqual({
			label: 'Test Route ABC',
			from: 'Place X',
			to: 'Place Y'
		});
	});

	test('Edit an existing map link', async ({ page }) => {
		await openDayView(page);

		// Add a link to edit
		await page.locator('button[aria-label="Add directions link"]').click();
		await page.locator('input[aria-label="Label"]').fill('Edit Test Link');
		await page.locator('input[aria-label="From"]').fill('A');
		await page.locator('input[aria-label="To"]').fill('B');
		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();
		await expect(page.locator('text=Edit Test Link').first()).toBeVisible();

		// Edit it
		await page.locator('button[aria-label="Edit Edit Test Link"]').click();
		const labelInput = page.locator('input[aria-label="Label"]');
		await labelInput.fill('Edited Link');
		await page.locator('input[aria-label="To"]').fill('C');
		await page.locator('button[type="submit"]', { hasText: 'Save' }).click();

		await expect(page.locator('text=Edited Link').first()).toBeVisible();
		const day2 = await idbGetTripDay(page, 'china-2026', 0);
		const editedLink = (day2?.mapLinks ?? []).find((l: any) => l.label === 'Edited Link');
		expect(editedLink).toEqual({ label: 'Edited Link', from: 'A', to: 'C' });
	});

	test('Delete a map link', async ({ page }) => {
		await openDayView(page);

		const dayBefore = await idbGetTripDay(page, 'china-2026', 0);
		const countBefore = (dayBefore?.mapLinks ?? []).length;

		await page.locator('button[aria-label="Add directions link"]').click();
		await page.locator('input[aria-label="Label"]').fill('Doomed Route');
		await page.locator('input[aria-label="From"]').fill('X');
		await page.locator('input[aria-label="To"]').fill('Y');
		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();
		await expect(page.locator('text=Doomed Route').first()).toBeVisible();

		await page.locator('button[aria-label="Delete Doomed Route"]').click();
		await expect(page.locator('text=Doomed Route')).not.toBeVisible();

		// Count should be back to original
		const dayAfter = await idbGetTripDay(page, 'china-2026', 0);
		expect((dayAfter?.mapLinks ?? []).length).toBe(countBefore);
	});

	test('New link auto-chains "from" to prior link\'s "to"', async ({ page }) => {
		await openDayView(page);

		// Add a link so we have a known "to" value
		await page.locator('button[aria-label="Add directions link"]').click();
		await page.locator('input[aria-label="Label"]').fill('Chain Test');
		await page.locator('input[aria-label="From"]').fill('Place A');
		await page.locator('input[aria-label="To"]').fill('Place B');
		await page.locator('button[type="submit"]', { hasText: 'Add' }).click();

		// New link — From should default to "Place B" (last link's "to")
		await page.locator('button[aria-label="Add directions link"]').click();
		const fromInput = page.locator('input[aria-label="From"]');
		await expect(fromInput).toHaveValue('Place B');
	});
});
