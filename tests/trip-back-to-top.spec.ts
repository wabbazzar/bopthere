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

test.describe('Trip page — floating back-to-top FAB', () => {
	test('global back-to-top FAB is visible on the trip page', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1200);

		const fab = page.locator('button[aria-label="Back to top"]');
		await expect(fab).toBeVisible();
	});

	test('clicking the FAB scrolls the window to top', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1200);

		// Scroll down first
		await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
		await page.waitForTimeout(300);
		const beforeY = await page.evaluate(() => window.scrollY);
		expect(beforeY).toBeGreaterThan(50);

		await page.locator('button[aria-label="Back to top"]').click();
		await page.waitForTimeout(800); // smooth scroll
		const afterY = await page.evaluate(() => window.scrollY);
		expect(afterY).toBeLessThanOrEqual(5);
	});

	test('chat FAB is on the left, scroll-top FAB is on the right', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1200);

		const chatFab = page.locator('button[aria-label="Trip assistant"]');
		const topFab = page.locator('button[aria-label="Back to top"]');
		await expect(chatFab).toBeVisible();
		await expect(topFab).toBeVisible();

		const chatBox = await chatFab.boundingBox();
		const topBox = await topFab.boundingBox();
		expect(chatBox).not.toBeNull();
		expect(topBox).not.toBeNull();

		// Chat should be on the left side, scroll-top on the right
		expect(chatBox!.x).toBeLessThan(page.viewportSize()!.width / 2);
		expect(topBox!.x).toBeGreaterThan(page.viewportSize()!.width / 2);

		// Both should be at the same Y position (bottom of viewport)
		expect(Math.abs(chatBox!.y - topBox!.y)).toBeLessThan(10);
	});
});
