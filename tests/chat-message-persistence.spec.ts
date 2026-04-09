/**
 * Chat Message Persistence Tests
 *
 * Tests that the user's message stays visible after sending,
 * even when polling returns stale data from the server.
 *
 * Bug this catches: polling overwrites optimistic local messages
 * with server state that hasn't processed the message yet, causing
 * the user's message to vanish until the response arrives.
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

test.describe('Chat — Message persistence during send', () => {
	test('User message stays visible while waiting for response', async ({ page }) => {
		// Mock: conversations endpoint always returns empty (server hasn't stored msg yet)
		// This simulates the race: poll fires, server says "no messages", but user just sent one
		await page.route('**/api/chat/conversations/**', async (route) => {
			if (route.request().method() === 'DELETE') {
				await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
			} else {
				// Always return empty — simulates server lag
				await route.fulfill({
					status: 200, contentType: 'application/json',
					body: JSON.stringify({ tripId: 'china-2026', messages: [] })
				});
			}
		});

		// Mock: send endpoint takes 5 seconds (simulates slow Claude response)
		await page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, 5000));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-${Date.now()}`,
					role: 'assistant',
					content: 'Here are my suggestions for your trip.',
					timestamp: new Date().toISOString()
				})
			});
		});

		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('h1', { timeout: 10000 });

		// Open chat drawer
		const fab = page.locator('button[aria-label="Trip assistant"]');
		await expect(fab).toBeVisible({ timeout: 5000 });
		await fab.click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 3000 });

		// Type and send a message
		const input = page.locator('.drawer-input input');
		await input.click();
		await page.keyboard.type('Best restaurants near the Bund?');
		await page.waitForTimeout(200);
		await cdpClick(page, '.send-btn');

		// User message should appear immediately
		const userMsg = page.locator('.msg--user');
		await expect(userMsg.first()).toBeVisible({ timeout: 2000 });
		await expect(userMsg.first()).toContainText('Best restaurants near the Bund?');

		// Wait 3 seconds — polling would have fired by now in the old code,
		// overwriting the message with the empty server response
		// With the fix, the message must stay visible
		await page.waitForTimeout(3000);

		// THE CRITICAL CHECK: user message must still be visible
		await expect(userMsg.first()).toBeVisible();
		await expect(userMsg.first()).toContainText('Best restaurants near the Bund?');

		// Loading indicator should be visible (still waiting for response)
		await expect(page.locator('.typing')).toBeVisible();

		// Wait for the mock response to arrive
		await expect(page.locator('.msg--assistant').first()).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.msg--assistant').first()).toContainText('suggestions');

		// User message should STILL be there alongside the response
		await expect(userMsg.first()).toBeVisible();
	});

	test('User message stays visible when suggestion sparkle is used', async ({ page }) => {
		// Same mocking strategy
		await page.route('**/api/chat/conversations/**', async (route) => {
			if (route.request().method() === 'DELETE') {
				await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
			} else {
				await route.fulfill({
					status: 200, contentType: 'application/json',
					body: JSON.stringify({ tripId: 'china-2026', messages: [] })
				});
			}
		});

		await page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, 4000));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-${Date.now()}`,
					role: 'assistant',
					content: 'Try **Yu Garden Tea House** for a peaceful morning.',
					timestamp: new Date().toISOString()
				})
			});
		});

		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('h1', { timeout: 10000 });

		// Switch to day view
		await page.getByRole('tab', { name: 'Day' }).click();
		await page.waitForSelector('button[aria-label="Next day"]', { timeout: 5000 });

		// Look for a suggest sparkle button (appears on empty suggestable fields)
		const sparkle = page.locator('button[aria-label="Get suggestions"]').first();
		if (await sparkle.isVisible({ timeout: 3000 }).catch(() => false)) {
			await sparkle.click();

			// The suggest popover should appear — pick options and submit
			const popover = page.locator('text=/energy|vibe/i');
			if (await popover.isVisible({ timeout: 2000 }).catch(() => false)) {
				// Click first energy chip and first interest chip
				const chips = page.locator('button').filter({ hasText: /low|medium|high|food|culture|nature/i });
				if (await chips.first().isVisible({ timeout: 1000 }).catch(() => false)) {
					await chips.first().click();
					// Click a second chip from a different category
					const secondChip = chips.nth(3);
					if (await secondChip.isVisible().catch(() => false)) {
						await secondChip.click();
					}
					// Submit
					const submitBtn = page.locator('button:has-text("Suggest")');
					if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
						await submitBtn.click();
					}
				}
			}

			// Chat drawer should open with the suggestion message
			await expect(page.locator('.drawer')).toBeVisible({ timeout: 3000 });
			const userMsg = page.locator('.msg--user');
			await expect(userMsg.first()).toBeVisible({ timeout: 5000 });

			// Wait 2s — polling must not clobber it
			await page.waitForTimeout(2000);
			await expect(userMsg.first()).toBeVisible();

			// Wait for response
			await expect(page.locator('.msg--assistant').first()).toBeVisible({ timeout: 10000 });
		}
	});
});
