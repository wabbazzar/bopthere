/**
 * Chat Fullscreen Toggle
 *
 * Verifies the fullscreen button in the chat drawer header expands the drawer
 * to cover the viewport and can be toggled back to the default size.
 */
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

test.describe('Chat — Fullscreen toggle', () => {
	test('Fullscreen button expands drawer to viewport and toggles back', async ({ page }) => {
		// On desktop (≥1024px) the drawer is already a full-height sidebar and the
		// fullscreen toggle is hidden via CSS — this test only applies to mobile/tablet.
		const vp = page.viewportSize();
		if (vp && vp.width >= 1024) {
			test.skip(true, 'Fullscreen toggle hidden on desktop sidebar layout');
			return;
		}
		// Avoid polling/network noise on the chat conversation endpoint
		await page.route('**/api/chat/conversations/**', async (route) => {
			await route.fulfill({
				status: 200, contentType: 'application/json',
				body: JSON.stringify({ tripId: 'china-2026', messages: [] })
			});
		});

		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('h1', { timeout: 10000 });

		const fab = page.locator('button[aria-label="Trip assistant"]');
		await expect(fab).toBeVisible({ timeout: 5000 });
		await fab.click();

		const drawer = page.locator('.drawer');
		await expect(drawer).toBeVisible({ timeout: 3000 });

		const viewport = page.viewportSize();
		if (!viewport) throw new Error('No viewport size');

		// Default drawer: height should be LESS than viewport (bottom sheet)
		const defaultBox = await drawer.boundingBox();
		expect(defaultBox).toBeTruthy();
		expect(defaultBox!.height).toBeLessThan(viewport.height);

		// Click fullscreen toggle
		const fsBtn = page.locator('button[aria-label="Full screen"]');
		await expect(fsBtn).toBeVisible();
		await fsBtn.click();

		// Drawer should now fill the viewport (allow 2px for sub-pixel rounding)
		await expect(page.locator('.drawer.fullscreen')).toBeVisible({ timeout: 1000 });
		const fsBox = await drawer.boundingBox();
		expect(fsBox).toBeTruthy();
		expect(fsBox!.height).toBeGreaterThanOrEqual(viewport.height - 2);
		expect(fsBox!.width).toBeGreaterThanOrEqual(viewport.width - 2);

		// Toggle should now read "Exit full screen"
		const exitBtn = page.locator('button[aria-label="Exit full screen"]');
		await expect(exitBtn).toBeVisible();

		// Toggle back
		await exitBtn.click();
		await expect(page.locator('.drawer.fullscreen')).toHaveCount(0);
		const restoredBox = await drawer.boundingBox();
		expect(restoredBox).toBeTruthy();
		expect(restoredBox!.height).toBeLessThan(viewport.height);
	});
});
