import { test, expect, type Page } from '@playwright/test';

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

/** Mock chat API with a configurable delay on messages endpoint */
function mockChatApi(page: Page, responseDelayMs: number) {
	return Promise.all([
		page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, responseDelayMs));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-${Date.now()}`,
					role: 'assistant',
					content: 'Here are some great options for you.',
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

test.describe('Chat Thinking Indicator', () => {
	test('shows thinking message while waiting for response', async ({ page }) => {
		// Delay mock response so we can observe the thinking indicator
		await mockChatApi(page, 4000);
		await navigateAuthenticated(page, '/trip/china-2026');

		// Open the chat drawer
		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		// Type and send a message
		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('What should we do today?');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		// The thinking indicator should appear with a text message
		const thinkingIndicator = page.locator('[aria-label="Thinking indicator"]');
		await expect(thinkingIndicator).toBeVisible({ timeout: 3000 });

		// Should contain thinking text (not just dots)
		const thinkingText = thinkingIndicator.locator('.thinking-text');
		await expect(thinkingText).toBeVisible({ timeout: 3000 });
		const text = await thinkingText.textContent();
		expect(text!.length).toBeGreaterThan(0);

		// Wait for the response — thinking indicator should disappear
		await expect(page.locator('.msg--assistant').first()).toBeVisible({ timeout: 10000 });
		await expect(thinkingIndicator).not.toBeVisible({ timeout: 3000 });
	});

	test('thinking message rotates after interval', async ({ page }) => {
		// Long delay to observe rotation (THINKING_ROTATE_MS = 3000)
		await mockChatApi(page, 8000);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Tell me about restaurants');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const thinkingText = page.locator('[aria-label="Thinking indicator"] .thinking-text');
		await expect(thinkingText).toBeVisible({ timeout: 3000 });

		// Capture the first message
		const firstMessage = await thinkingText.textContent();

		// Wait for rotation (3s interval + buffer)
		await page.waitForTimeout(3500);

		// The message should have changed
		const secondMessage = await thinkingText.textContent();
		expect(secondMessage).not.toBe(firstMessage);

		// Wait for response to complete cleanly
		await expect(page.locator('.msg--assistant').first()).toBeVisible({ timeout: 10000 });
	});

	test('thinking indicator disappears on error', async ({ page }) => {
		// Mock an error response
		await Promise.all([
			page.route('**/api/chat/messages', async (route) => {
				await new Promise((r) => setTimeout(r, 1500));
				await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal Server Error"}' });
			}),
			page.route('**/api/chat/conversations/**', async (route) => {
				await route.fulfill({
					status: 200, contentType: 'application/json',
					body: JSON.stringify({ tripId: 'china-2026', messages: [] })
				});
			})
		]);

		await navigateAuthenticated(page, '/trip/china-2026');
		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('This will fail');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		// Thinking indicator appears
		const thinkingIndicator = page.locator('[aria-label="Thinking indicator"]');
		await expect(thinkingIndicator).toBeVisible({ timeout: 3000 });

		// After error, thinking indicator should disappear
		await expect(thinkingIndicator).not.toBeVisible({ timeout: 10000 });

		// Error message should be shown
		await expect(page.locator('.error-msg')).toBeVisible({ timeout: 3000 });
	});
});
