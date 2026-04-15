import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const CHAT_API = 'https://api.heatherandwesley.com';

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
		localStorage.setItem('hw-auth-token', jwt);
		localStorage.setItem('hw-auth-user', JSON.stringify(user));
		return jwt;
	}, TEST_USER);
	return token;
}

async function navigateAuthenticated(page: Page, path: string) {
	const token = await injectAuth(page);
	await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(2000); // let Svelte hydrate and auth check run
	await page.waitForSelector('a:has-text("H&W")', { timeout: 5000 }).catch(() => {});
	return token;
}

/** Click an element via CDP to avoid Playwright waiting for async event handlers */
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

function mockChatApi(page: Page) {
	return Promise.all([
		page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, 200));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-${Date.now()}`,
					role: 'assistant',
					content: 'Try **Din Tai Fung** for soup dumplings near The Bund.',
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

test.describe('Chat E2E', () => {
	test('1 - FAB visible on trip page', async ({ page }) => {
		await navigateAuthenticated(page, '/trip/china-2026');
		await expect(page.locator('button[aria-label="Trip assistant"]')).toBeVisible({ timeout: 5000 });
		await page.screenshot({ path: 'test-results/01-trip-page.png' });
	});

	test('2 - Drawer opens and closes', async ({ page }) => {
		await mockChatApi(page); // mock so drawer doesn't load real conversation
		await navigateAuthenticated(page, '/trip/china-2026');
		const fab = page.locator('button[aria-label="Trip assistant"]');
		await expect(fab).toBeVisible({ timeout: 5000 });

		await fab.click();
		await expect(page.locator('.drawer')).toBeVisible();
		await page.screenshot({ path: 'test-results/02-drawer-open.png' });

		await page.locator('.backdrop').click();
		await expect(page.locator('.drawer')).not.toBeVisible();
	});

	test('3 - Send and receive message (mocked)', async ({ page }) => {
		await mockChatApi(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible();

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Best restaurant?');
		await page.waitForTimeout(300);

		// Use CDP click to avoid Playwright blocking on async handlers
		await cdpClick(page, '.send-btn');

		await expect(page.locator('.msg--user').first()).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.msg--assistant').first()).toBeVisible({ timeout: 10000 });

		const text = await page.locator('.msg--assistant').first().textContent();
		expect(text).toContain('Din Tai Fung');
		await page.screenshot({ path: 'test-results/03-send-receive.png' });
	});

	test('4 - Clear conversation (mocked)', async ({ page }) => {
		await mockChatApi(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Hello');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');
		await expect(page.locator('.msg--assistant').first()).toBeVisible({ timeout: 10000 });

		await page.locator('.drawer-btn:has-text("Clear")').click();
		await page.waitForTimeout(500);
		await expect(page.locator('.empty-state')).toBeVisible();
		await page.screenshot({ path: 'test-results/04-cleared.png' });
	});

	test('5 - Input font-size prevents iOS zoom', async ({ page }) => {
		await mockChatApi(page);
		await navigateAuthenticated(page, '/trip/china-2026');
		const fab = page.locator('button[aria-label="Trip assistant"]');
		await expect(fab).toBeVisible({ timeout: 5000 });

		// Open drawer — use standard click, then wait for drawer
		await fab.click();
		const drawer = page.locator('.drawer');
		await expect(drawer).toBeVisible({ timeout: 5000 });

		// Check input font-size is >= 16px (iOS auto-zooms on focus below this)
		const input = drawer.locator('textarea');
		await expect(input).toBeVisible();
		const fontSize = await input.evaluate((el) => getComputedStyle(el).fontSize);
		const pxValue = parseFloat(fontSize);
		expect(pxValue).toBeGreaterThanOrEqual(16);

		// Type a message and verify send button stays visible and in viewport
		await input.fill('Test message');
		await page.waitForTimeout(300);
		const sendBtn = drawer.locator('button:has-text("↑")');
		await expect(sendBtn).toBeVisible();
		await expect(sendBtn).toBeInViewport();
		await page.screenshot({ path: 'test-results/05-input-no-zoom.png' });
	});

	test('6 - Viewport meta prevents zoom lock', async ({ page }) => {
		await navigateAuthenticated(page, '/trip/china-2026');
		const content = await page.locator('meta[name="viewport"]').getAttribute('content');
		expect(content).toContain('maximum-scale=1');
	});

	test('7 - Live Claude API', async ({ page }) => {
		// Use a throwaway trip ID so test messages never pollute the user's real conversation.
		// Clean up the test conversation when done.
		const TEST_TRIP = 'guardian-test';
		const token = await navigateAuthenticated(page, '/trip/china-2026');

		// Send a message directly via API (not through the UI) to avoid clobbering china-2026
		const res = await page.request.post(`${CHAT_API}/api/chat/messages`, {
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			data: {
				tripId: TEST_TRIP,
				message: 'Say exactly: test-ok',
				systemPrompt: 'You are a test assistant. Follow instructions exactly.'
			}
		});

		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.content.length).toBeGreaterThan(0);
		console.log('  Live response:', body.content);

		// Clean up — delete the test conversation so it doesn't accumulate
		await page.request.delete(`${CHAT_API}/api/chat/conversations/${TEST_TRIP}`, {
			headers: { Authorization: `Bearer ${token}` }
		}).catch(() => {});
	});
});
