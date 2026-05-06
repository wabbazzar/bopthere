import { test, expect, type Page } from '@playwright/test';
import { idbGetTripDay } from './helpers/idb';

const BASE_URL = 'http://localhost:5174';

const TEST_USER = {
	username: 'wesley',
	email: 'wesleybeckner@gmail.com',
	full_name: 'Wesley Beckner',
	role: 'admin'
};

async function injectAuth(page: Page): Promise<string> {
	await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
	const token = await page.evaluate(async (user) => {
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
		return jwt;
	}, TEST_USER);
	return token;
}

async function navigateAuthenticated(page: Page, path: string) {
	await injectAuth(page);
	await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(2000);
	await page.waitForSelector('a:has-text("BopThere")', { timeout: 5000 }).catch(() => {});
}

async function cdpClick(page: Page, selector: string) {
	const cdp = await page.context().newCDPSession(page);
	const box = await page.locator(selector).boundingBox();
	if (!box) throw new Error(`Element not found: ${selector}`);
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
	await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
	await cdp.detach();
}

const MAP_LINKS_RESPONSE = `Here are the directions for Day 8 in Zhangjiajie.

\`\`\`MAP_LINKS
{"dayIndex": 7, "mapLinks": [
  {"label": "Hotel to Tianmen Mountain", "from": "Hampton by Hilton Zhangjiajie Tianmen Mountain", "to": "Tianmen Mountain National Park"},
  {"label": "Tianmen to Glass Bridge", "from": "Tianmen Mountain National Park", "to": "Zhangjiajie Grand Canyon Glass Bridge"},
  {"label": "Glass Bridge back to Hotel", "from": "Zhangjiajie Grand Canyon Glass Bridge", "to": "Hampton by Hilton Zhangjiajie Tianmen Mountain"}
]}
\`\`\``;

function mockChatApiWithMapLinks(page: Page) {
	return Promise.all([
		page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, 300));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-map-${Date.now()}`,
					role: 'assistant',
					content: MAP_LINKS_RESPONSE,
					timestamp: new Date().toISOString()
				})
			});
		}),
		page.route('**/api/chat/conversations/**', async (route) => {
			if (route.request().method() === 'DELETE') {
				await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
			} else {
				await route.fulfill({
					status: 200, contentType: 'application/json',
					body: JSON.stringify({ tripId: 'china-2026', messages: [] })
				});
			}
		})
	]);
}

test.describe('Chat MAP_LINKS Actions', () => {
	test('shows map link preview with tappable links', async ({ page }) => {
		await mockChatApiWithMapLinks(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Build map links for day 8');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Map link action block should appear
		const actionBlock = assistant.locator('[aria-label="Map link actions"]');
		await expect(actionBlock).toBeVisible();

		// Should have 3 individual map link previews + 1 composite
		const links = actionBlock.locator('.map-link-anchor');
		expect(await links.count()).toBe(4); // 3 individual + 1 "Full day route"

		// Each individual link should point to Google Maps
		const href = await links.first().getAttribute('href');
		expect(href).toContain('google.com/maps/dir/');

		// Full day route link should exist
		const fullRoute = actionBlock.locator('text=Full day route');
		await expect(fullRoute).toBeVisible();

		// Apply and Dismiss buttons should be present
		await expect(actionBlock.locator('[aria-label="Apply map links"]')).toBeVisible();
		await expect(actionBlock.locator('[aria-label="Dismiss map links"]')).toBeVisible();

		// Raw MAP_LINKS block should NOT be visible
		const bubbleText = await assistant.locator('.msg-bubble').textContent();
		expect(bubbleText).not.toContain('MAP_LINKS');
		expect(bubbleText).not.toContain('dayIndex');
	});

	test('Apply adds map links to trip day', async ({ page }) => {
		await mockChatApiWithMapLinks(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Build map links for day 8');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Click Apply
		await assistant.locator('[aria-label="Apply map links"]').click();

		// Action block should disappear, "applied" badge should show
		await expect(assistant.locator('[aria-label="Map link actions"]')).not.toBeVisible({ timeout: 3000 });
		await expect(assistant.locator('[aria-label="Map links applied"]')).toBeVisible();

		// Verify mapLinks were saved to trip data
		const day7 = await idbGetTripDay(page, 'china-2026', 7);
		const mapLinks = day7?.mapLinks ?? null;
		expect(mapLinks).toHaveLength(3);
		expect(mapLinks[0].label).toBe('Hotel to Tianmen Mountain');
		expect(mapLinks[2].to).toContain('Hampton by Hilton');
	});

	test('Dismiss removes action block without updating trip', async ({ page }) => {
		await mockChatApiWithMapLinks(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Build map links for day 8');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Capture original mapLinks
		const beforeDay = await idbGetTripDay(page, 'china-2026', 7);
		const beforeLinks = beforeDay?.mapLinks ?? null;

		// Click Dismiss
		await assistant.locator('[aria-label="Dismiss map links"]').click();

		// Action block gone, no applied badge
		await expect(assistant.locator('[aria-label="Map link actions"]')).not.toBeVisible({ timeout: 3000 });
		await expect(assistant.locator('[aria-label="Map links applied"]')).not.toBeVisible();

		// Trip data unchanged
		const afterDay = await idbGetTripDay(page, 'china-2026', 7);
		const afterLinks = afterDay?.mapLinks ?? null;
		expect(JSON.stringify(afterLinks)).toBe(JSON.stringify(beforeLinks));
	});
});
