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

test.describe('Trip page — quick nav buttons', () => {
	test('Bookings button scrolls the bookings section into view', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500);

		const bookingsBtn = page.locator('button[aria-label="Jump to bookings"]');
		await expect(bookingsBtn).toBeVisible({ timeout: 5000 });

		// Scroll to top first so the click has somewhere to scroll TO
		await page.evaluate(() => window.scrollTo(0, 0));
		const before = await page.evaluate(() => window.scrollY);
		expect(before).toBeLessThan(50);

		await bookingsBtn.click();
		// smooth scroll animation — give it a beat
		await page.waitForTimeout(700);

		const bookingsSection = page.locator('#bookings-section');
		await expect(bookingsSection).toBeInViewport({ ratio: 0.1 });
		const after = await page.evaluate(() => window.scrollY);
		expect(after).toBeGreaterThan(before + 50);
	});

	test('Todos button scrolls the todos section into view', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500);

		const todosBtn = page.locator('button[aria-label="Jump to todos"]');
		await expect(todosBtn).toBeVisible({ timeout: 5000 });

		await page.evaluate(() => window.scrollTo(0, 0));
		const before = await page.evaluate(() => window.scrollY);

		await todosBtn.click();
		await page.waitForTimeout(700);

		const todosSection = page.locator('#todos-section');
		await expect(todosSection).toBeInViewport({ ratio: 0.1 });
		const after = await page.evaluate(() => window.scrollY);
		expect(after).toBeGreaterThan(before + 50);
	});

	test('Quick-nav buttons are visible in a row', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500);

		const journalBtn = page.locator('button[aria-label="Jump to journal"]');
		const todosBtn = page.locator('button[aria-label="Jump to todos"]');
		await expect(journalBtn).toBeVisible({ timeout: 5000 });
		await expect(todosBtn).toBeVisible();

		const journalBox = await journalBtn.boundingBox();
		const todosBox = await todosBtn.boundingBox();
		expect(journalBox && todosBox).toBeTruthy();
		// Same row (vertical center within 10px)
		const journalCenterY = journalBox!.y + journalBox!.height / 2;
		const todosCenterY = todosBox!.y + todosBox!.height / 2;
		expect(Math.abs(journalCenterY - todosCenterY)).toBeLessThanOrEqual(10);
	});
});
