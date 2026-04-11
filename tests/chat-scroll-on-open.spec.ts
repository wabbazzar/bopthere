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

function longMessages(count: number) {
	const msgs = [];
	for (let i = 0; i < count; i++) {
		msgs.push({
			id: `msg-${i}`,
			role: i % 2 === 0 ? 'user' : 'assistant',
			content:
				`Message number ${i}. ` +
				'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(6),
			timestamp: new Date(Date.now() - (count - i) * 1000).toISOString()
		});
	}
	return msgs;
}

async function mockLongConversation(page: Page) {
	await page.route('**/api/chat/conversations/**', async (route) => {
		if (route.request().method() === 'DELETE') {
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ tripId: 'china-2026', messages: longMessages(30) })
		});
	});
}

async function getScrollState(page: Page) {
	return page.evaluate(() => {
		const el = document.querySelector('.drawer-messages') as HTMLElement | null;
		if (!el) return null;
		return {
			scrollTop: el.scrollTop,
			scrollHeight: el.scrollHeight,
			clientHeight: el.clientHeight
		};
	});
}

test.describe('Chat drawer — scroll to bottom on open', () => {
	test('opens scrolled to the most recent message on first open', async ({ page }) => {
		await mockLongConversation(page);
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500);

		const fab = page.locator('button[aria-label="Trip assistant"]');
		await expect(fab).toBeVisible({ timeout: 5000 });
		await fab.click();

		await expect(page.locator('.drawer')).toBeVisible();
		// Wait for the long message list to render + scroll to settle
		await expect(page.locator('.drawer-messages .msg').nth(29)).toBeVisible({ timeout: 5000 });
		await page.waitForTimeout(200);

		const state = await getScrollState(page);
		expect(state).not.toBeNull();
		// Must actually be scrollable (otherwise the test is meaningless)
		expect(state!.scrollHeight).toBeGreaterThan(state!.clientHeight + 50);
		// Bottom = scrollTop + clientHeight ≈ scrollHeight (allow 4px slack)
		const distanceFromBottom = state!.scrollHeight - (state!.scrollTop + state!.clientHeight);
		expect(distanceFromBottom).toBeLessThanOrEqual(4);
	});

	test('re-scrolls to bottom when drawer is reopened after scrolling up', async ({ page }) => {
		await mockLongConversation(page);
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500);

		const fab = page.locator('button[aria-label="Trip assistant"]');
		await expect(fab).toBeVisible({ timeout: 5000 });

		// First open
		await fab.click();
		await expect(page.locator('.drawer')).toBeVisible();
		await expect(page.locator('.drawer-messages .msg').nth(29)).toBeVisible({ timeout: 5000 });
		await page.waitForTimeout(200);

		// Scroll to the top inside the drawer
		await page.evaluate(() => {
			const el = document.querySelector('.drawer-messages') as HTMLElement | null;
			if (el) el.scrollTop = 0;
		});
		const afterScrollUp = await getScrollState(page);
		expect(afterScrollUp!.scrollTop).toBeLessThan(10);

		// Close (× button — works across viewports) and reopen
		await page.locator('.drawer-close').click();
		await expect(page.locator('.drawer')).not.toBeVisible();
		await fab.click();
		await expect(page.locator('.drawer')).toBeVisible();
		await expect(page.locator('.drawer-messages .msg').nth(29)).toBeVisible({ timeout: 5000 });
		await page.waitForTimeout(200);

		const state = await getScrollState(page);
		expect(state).not.toBeNull();
		const distanceFromBottom = state!.scrollHeight - (state!.scrollTop + state!.clientHeight);
		expect(distanceFromBottom).toBeLessThanOrEqual(4);
	});
});
