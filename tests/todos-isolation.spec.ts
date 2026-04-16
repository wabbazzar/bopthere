/**
 * Trip-todos isolation — guards against the bug where China's defaults
 * leaked into the Europe trip's todo list (and got persisted server-side).
 *
 * These tests drive a real browser against the real backend and assert
 * that adding/clearing todos in one trip does NOT bleed into another.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

const TEST_USER = {
	username: 'wesley',
	email: 'wesleybeckner@gmail.com',
	full_name: 'Wesley Beckner',
	role: 'admin'
};

const CHINA_ID = 'china-2026';
const EUROPE_ID = 'europe-2026-2026';

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

/** Wipe ALL local todo caches so the page boot reflects real server state. */
async function wipeLocalTodos(page: Page) {
	await page.evaluate(() => {
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && (k.startsWith('hw-trip-todos-') || k === 'hw-todos-meta' || k === 'hw-todos-schema-version')) {
				keysToRemove.push(k);
			}
		}
		for (const k of keysToRemove) localStorage.removeItem(k);
	});
}

async function goToTripTodos(page: Page, tripId: string) {
	await page.goto(`${BASE_URL}/trip/${tripId}`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1', { timeout: 10000 });
	// Wait for the To Do section heading to be present
	await page.locator('text="To Do"').first().waitFor({ timeout: 5000 });
	// Allow the async pullFromServer to settle
	await page.waitForLoadState('networkidle');
}

async function readTodos(page: Page): Promise<string[]> {
	const items = page.locator('ul li span[title="Tap to edit"]');
	const count = await items.count();
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		out.push(((await items.nth(i).textContent()) ?? '').trim());
	}
	return out;
}

test.describe('Todo isolation between trips', () => {
	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await wipeLocalTodos(page);
	});

	test('China-specific todo text never appears in the Europe trip', async ({ page }) => {
		await goToTripTodos(page, EUROPE_ID);
		const europeTodos = await readTodos(page);
		// The historical pollution: any of these shows up means the bug is back.
		const polluted = europeTodos.some((t) =>
			/Wulingyuan|intra-China|Confirm Wulingyuan hotel/i.test(t)
		);
		expect(polluted, `Europe todos contained China-specific text: ${JSON.stringify(europeTodos)}`).toBe(false);
	});

	test('A todo added to Europe does NOT appear in China', async ({ page }) => {
		const unique = `Europe-only ${Date.now()}`;

		await goToTripTodos(page, EUROPE_ID);
		await page.locator('input[placeholder="Add a task..."]').fill(unique);
		await page.locator('input[placeholder="Add a task..."]').press('Enter');
		await expect(page.locator(`text=${unique}`)).toBeVisible();

		// Wait for the 2s debounced PUT to flush
		await page.waitForTimeout(2500);
		await page.waitForLoadState('networkidle');

		// Now visit China — the unique Europe todo must NOT be there
		await wipeLocalTodos(page); // force re-pull from server
		await goToTripTodos(page, CHINA_ID);
		const chinaTodos = await readTodos(page);
		expect(chinaTodos).not.toContain(unique);

		// Cleanup: remove the unique todo from Europe so re-runs don't accumulate
		await wipeLocalTodos(page);
		await goToTripTodos(page, EUROPE_ID);
		const deleteBtn = page.locator('li', { hasText: unique }).locator('button[aria-label="Delete todo"]');
		await deleteBtn.dispatchEvent('click');
		await page.waitForTimeout(2500);
	});

	test('A todo added to China does NOT appear in Europe', async ({ page }) => {
		const unique = `China-only ${Date.now()}`;

		await goToTripTodos(page, CHINA_ID);
		await page.locator('input[placeholder="Add a task..."]').fill(unique);
		await page.locator('input[placeholder="Add a task..."]').press('Enter');
		await expect(page.locator(`text=${unique}`)).toBeVisible();

		await page.waitForTimeout(2500);
		await page.waitForLoadState('networkidle');

		await wipeLocalTodos(page);
		await goToTripTodos(page, EUROPE_ID);
		const europeTodos = await readTodos(page);
		expect(europeTodos).not.toContain(unique);

		// Cleanup: remove the unique todo we added to China so the suite is repeatable
		await wipeLocalTodos(page);
		await goToTripTodos(page, CHINA_ID);
		const deleteBtn = page.locator('li', { hasText: unique }).locator('button[aria-label="Delete todo"]');
		await deleteBtn.dispatchEvent('click');
		await page.waitForTimeout(2500);
	});
});
