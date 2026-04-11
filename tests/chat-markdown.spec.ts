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
	await page.waitForSelector('a:has-text("H&W")', { timeout: 5000 }).catch(() => {});
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

test.describe('Chat Markdown Rendering', () => {
	test('renders links as clickable anchor tags', async ({ page }) => {
		const markdownContent = 'Try **Din Tai Fung** for dumplings.\n[Reviews](https://www.google.com/search?q=Din+Tai+Fung+Shanghai+reviews)\n- Great soup dumplings\n- Affordable prices';

		await Promise.all([
			page.route('**/api/chat/messages', async (route) => {
				await new Promise((r) => setTimeout(r, 200));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						id: `mock-${Date.now()}`,
						role: 'assistant',
						content: markdownContent,
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

		await navigateAuthenticated(page, '/trip/china-2026');
		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Best restaurant?');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Link should render as <a> with correct href
		const link = assistant.locator('a');
		await expect(link).toBeVisible();
		expect(await link.textContent()).toBe('Reviews');
		expect(await link.getAttribute('href')).toContain('google.com/search');
		expect(await link.getAttribute('target')).toBe('_blank');

		// Bold should render
		const bold = assistant.locator('strong');
		await expect(bold).toBeVisible();
		expect(await bold.textContent()).toBe('Din Tai Fung');

		// List items should render
		const listItems = assistant.locator('li');
		expect(await listItems.count()).toBe(2);
	});

	test('escapes HTML to prevent XSS', async ({ page }) => {
		const xssContent = 'Hello <script>alert("xss")</script> world';

		await Promise.all([
			page.route('**/api/chat/messages', async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						id: `mock-${Date.now()}`,
						role: 'assistant',
						content: xssContent,
						timestamp: new Date().toISOString()
					})
				});
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
		await page.keyboard.type('test');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Script tag should be escaped, not executed
		const text = await assistant.textContent();
		expect(text).toContain('<script>');
		// No actual script elements should exist
		const scripts = assistant.locator('script');
		expect(await scripts.count()).toBe(0);
	});
});
