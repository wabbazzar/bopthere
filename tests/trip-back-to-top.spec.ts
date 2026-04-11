import { test, expect, type Page } from '@playwright/test';

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
		localStorage.setItem('hw-auth-token', jwt);
		localStorage.setItem('hw-auth-user', JSON.stringify(user));
	}, TEST_USER);
}

test.describe('Trip page — back to top chevron', () => {
	test('each section shows its own back-to-top button', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1200);

		const bookingsBtn = page.locator('#bookings-section button[aria-label="Back to top"]');
		const todosBtn = page.locator('#todos-section button[aria-label="Back to top"]');
		await expect(bookingsBtn).toBeVisible();
		await expect(todosBtn).toBeVisible();
	});

	test('clicking the bookings back-to-top chevron scrolls the window to top', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1200);

		// Scroll down to the bookings section first
		await page.locator('#bookings-section').scrollIntoViewIfNeeded();
		await page.waitForTimeout(400);
		const beforeY = await page.evaluate(() => window.scrollY);
		expect(beforeY).toBeGreaterThan(50);

		await page.locator('#bookings-section button[aria-label="Back to top"]').click({ force: true });
		await page.waitForTimeout(800); // smooth scroll
		const afterY = await page.evaluate(() => window.scrollY);
		expect(afterY).toBeLessThanOrEqual(5);
	});

	test('clicking the todos back-to-top chevron scrolls the window to top', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1200);

		await page.locator('#todos-section').scrollIntoViewIfNeeded();
		await page.waitForTimeout(400);
		const beforeY = await page.evaluate(() => window.scrollY);
		expect(beforeY).toBeGreaterThan(50);

		await page.locator('#todos-section button[aria-label="Back to top"]').click({ force: true });
		await page.waitForTimeout(800);
		const afterY = await page.evaluate(() => window.scrollY);
		expect(afterY).toBeLessThanOrEqual(5);
	});

	test('the bob animation is declared on the button', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1200);

		const btn = page.locator('#todos-section button[aria-label="Back to top"]').first();
		await expect(btn).toBeVisible();
		const animationName = await btn.evaluate((el) => getComputedStyle(el).animationName);
		// Svelte scopes keyframe names — just check it's not "none"
		expect(animationName).not.toBe('none');
	});
});
