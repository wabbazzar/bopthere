import { test, expect, type Page } from '@playwright/test';
import { idbGet } from './helpers/idb';

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

function mockChatApiWithAction(page: Page) {
	const actionContent = `I'll add **Din Tai Fung** to your evening on Day 1.

\`\`\`TRIP_UPDATE
[{"dayIndex": 0, "field": "evening", "value": "Din Tai Fung - soup dumplings near The Bund"}]
\`\`\``;

	return Promise.all([
		page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, 300));
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-action-${Date.now()}`,
					role: 'assistant',
					content: actionContent,
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

test.describe('Chat Trip Update Actions', () => {
	test('shows Apply/Dismiss buttons for TRIP_UPDATE response', async ({ page }) => {
		await mockChatApiWithAction(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Put Din Tai Fung in the evening for day 1');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Should show the action block with Apply and Dismiss buttons
		const actionBlock = assistant.locator('[aria-label="Trip update actions"]');
		await expect(actionBlock).toBeVisible();

		const applyBtn = assistant.locator('[aria-label="Apply trip updates"]');
		const dismissBtn = assistant.locator('[aria-label="Dismiss trip updates"]');
		await expect(applyBtn).toBeVisible();
		await expect(dismissBtn).toBeVisible();

		// Should show the action summary (Day 1 Evening: ...)
		const summary = actionBlock.locator('.action-item');
		const summaryText = await summary.textContent();
		expect(summaryText).toContain('Day 1');
		expect(summaryText).toContain('Evening');
		expect(summaryText).toContain('Din Tai Fung');

		// The raw TRIP_UPDATE block should NOT be visible in the message text
		const bubbleText = await assistant.locator('.msg-bubble').textContent();
		expect(bubbleText).not.toContain('TRIP_UPDATE');
		expect(bubbleText).not.toContain('dayIndex');
	});

	test('Apply button updates trip data and shows Applied badge', async ({ page }) => {
		await mockChatApiWithAction(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Put Din Tai Fung in the evening for day 1');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Click Apply
		await assistant.locator('[aria-label="Apply trip updates"]').click();

		// Apply/Dismiss buttons should disappear
		await expect(assistant.locator('[aria-label="Trip update actions"]')).not.toBeVisible({ timeout: 3000 });

		// Should show "Applied to trip" badge
		await expect(assistant.locator('[aria-label="Trip updates applied"]')).toBeVisible();

		// Verify the trip data was actually updated by checking IndexedDB
		const trip = await idbGet(page, 'trips', 'china-2026');
		expect(trip?.days?.[0]?.evening).toContain('Din Tai Fung');
	});

	test('Dismiss button removes action block without updating trip', async ({ page }) => {
		await mockChatApiWithAction(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		// Capture original evening value
		const originalTrip = await idbGet(page, 'trips', 'china-2026');
		const originalEvening = originalTrip?.days?.[0]?.evening ?? null;

		await page.locator('button[aria-label="Trip assistant"]').click();
		await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });

		const input = page.locator('.drawer-input textarea');
		await input.click();
		await page.keyboard.type('Put Din Tai Fung in the evening for day 1');
		await page.waitForTimeout(300);
		await cdpClick(page, '.send-btn');

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		// Click Dismiss
		await assistant.locator('[aria-label="Dismiss trip updates"]').click();

		// Action block should disappear
		await expect(assistant.locator('[aria-label="Trip update actions"]')).not.toBeVisible({ timeout: 3000 });
		// No "Applied" badge either
		await expect(assistant.locator('[aria-label="Trip updates applied"]')).not.toBeVisible();

		// Trip data should NOT have changed
		const currentTrip = await idbGet(page, 'trips', 'china-2026');
		const currentEvening = currentTrip?.days?.[0]?.evening ?? null;
		expect(currentEvening).toBe(originalEvening);
	});
});
