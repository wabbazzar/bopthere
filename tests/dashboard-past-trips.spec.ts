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

test.describe('Dashboard — Past Trips section', () => {
	test('top nav no longer contains a Wedding Archive link', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1000);

		const header = page.locator('header');
		await expect(header).toBeVisible();
		await expect(header.getByRole('link', { name: /wedding archive/i })).toHaveCount(0);
	});

	test('dashboard shows a "Past Trips" section with the wedding archive card', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1000);

		await expect(page.getByText('Past Trips', { exact: true })).toBeVisible();

		const card = page.locator('a[aria-label="Open wedding archive"]');
		await expect(card).toBeVisible();
		await expect(card).toContainText('Wedding Archive');
		await expect(card).toContainText('Maui');
		await expect(card).toHaveAttribute('href', '/archive/');
	});

	test('the wedding archive card is positioned below the Upcoming Trips list', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1000);

		const upcomingLabel = page.getByText('Upcoming Trips', { exact: true });
		const pastLabel = page.getByText('Past Trips', { exact: true });
		const upcomingBox = await upcomingLabel.boundingBox();
		const pastBox = await pastLabel.boundingBox();
		expect(upcomingBox && pastBox).toBeTruthy();
		expect(pastBox!.y).toBeGreaterThan(upcomingBox!.y);
	});
});
