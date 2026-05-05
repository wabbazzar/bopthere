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
		// Clear trip localStorage so we ONLY see server data
		localStorage.removeItem('hw-trips');
		localStorage.removeItem('hw-trips-meta');
	}, TEST_USER);
}

/** Navigate to a specific day by clicking the mini-calendar chip or Next arrows */
async function goToDay(page: Page, dateSuffix: string) {
	// Switch to Day view
	await page.locator('button[role="tab"]:has-text("Day")').click();
	await page.waitForTimeout(300);
	// Try clicking the mini-calendar chip that matches the date
	const chip = page.locator(`text=/${dateSuffix.replace('-', '\\-')}/`).first();
	if (await chip.isVisible()) {
		await chip.click();
		await page.waitForTimeout(300);
		return;
	}
	// Fallback: navigate in both directions (backward first to handle today > target)
	for (let pass = 0; pass < 2; pass++) {
		for (let i = 0; i < 12; i++) {
			const text = await page.locator('main').textContent();
			if (text && text.includes(dateSuffix)) return;
			const btn = page.locator(
				pass === 0 ? 'button[aria-label="Previous day"]' : 'button[aria-label="Next day"]'
			);
			if (!await btn.isEnabled()) break;
			await btn.click();
			await page.waitForTimeout(200);
		}
	}
}

test.describe('Trip data — server persistence verification', () => {
	test('day 7 activities appear from server after clearing localStorage', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(2500);

		await goToDay(page, '04-28');

		const content = await page.locator('main').textContent();
		expect(content).toContain('Tianzi Mountain');
		expect(content).toContain('Bailong Elevator');
		expect(content).toContain('Baofeng Lake');
	});

	test('day 8 activities appear from server', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(2500);

		await goToDay(page, '04-29');

		const content = await page.locator('main').textContent();
		expect(content).toContain('Glass Bridge');
		expect(content).toContain('Tianmen Mountain');
		expect(content).toContain('Hampton by Hilton');
	});

	test('day 9 activities appear from server (exact TRIP_UPDATE text)', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(2500);

		await goToDay(page, '04-30');

		const content = await page.locator('main').textContent();
		// Day 9 morning was edited by Heather during the trip
		expect(content).toContain('HEATHER MORNING');
		expect(content).toContain('Shanghai EDITION');
		expect(content).toContain('Hehua Airport');
	});
});
