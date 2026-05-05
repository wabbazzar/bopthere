import { test, expect, type Page } from '@playwright/test';
import { idbGetTripMeta, idbGetTripDay, idbGetTripDayCount } from './helpers/idb';

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
	// Scrub any previously-added test trip so we start clean
	await page.evaluate(async () => {
		const raw = localStorage.getItem('hw-trips');
		if (raw) {
			try {
				const parsed = JSON.parse(raw);
				delete parsed['portugal-spring-2027'];
				localStorage.setItem('hw-trips', JSON.stringify(parsed));
			} catch {}
		}
		// Delete the IndexedDB entirely — the app will recreate it on next load
		await new Promise<void>((resolve) => {
			const req = indexedDB.deleteDatabase('hw-travel');
			req.onsuccess = () => resolve();
			req.onerror = () => resolve();
			req.onblocked = () => resolve();
		});
	});
	await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1500);
}

function mockChatApiWithCreate(page: Page) {
	const createContent = `Sure — I'll set up a skeleton for your Portugal trip.

\`\`\`TRIP_CREATE
{"id": "portugal-spring-2027", "name": "Portugal Spring 2027", "startDate": "2027-04-10", "endDate": "2027-04-14", "destinations": ["Lisbon", "Porto"]}
\`\`\``;

	return Promise.all([
		page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, 200));
			await route.fulfill({
				status: 200, contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-create-${Date.now()}`,
					role: 'assistant',
					content: createContent,
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
		}),
		// Don't hit the real trips API during this test
		page.route('**/api/trips/**', async (route) => {
			await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
		})
	]);
}

async function askAgentForNewTrip(page: Page) {
	await page.locator('button[aria-label="Trip assistant"]').click();
	await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });
	const input = page.locator('.drawer-input textarea');
	await input.click();
	await page.keyboard.type('Plan a new trip to Portugal April 10-14 2027');
	await page.waitForTimeout(200);
	await page.locator('.send-btn').click({ force: true });
}

test.describe('Chat — Create Trip (via chat FAB)', () => {
	test('agent TRIP_CREATE response renders a create-trip action block', async ({ page }) => {
		await mockChatApiWithCreate(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await askAgentForNewTrip(page);

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		const block = assistant.locator('[aria-label="Create trip action"]');
		await expect(block).toBeVisible();
		await expect(block).toContainText('Portugal Spring 2027');
		await expect(block).toContainText('2027-04-10');
		await expect(block).toContainText('Lisbon');

		// Raw block markup is stripped from the visible message
		const bubbleText = await assistant.locator('.msg-bubble').textContent();
		expect(bubbleText).not.toContain('TRIP_CREATE');
		expect(bubbleText).not.toContain('"id":');
	});

	test('Apply creates the trip in localStorage and navigates to it', async ({ page }) => {
		await mockChatApiWithCreate(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await askAgentForNewTrip(page);

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		await assistant.locator('[aria-label="Create this trip"]').click();

		// Wait for the trip metadata to appear in IndexedDB (per-entry format)
		await page.waitForFunction(() => {
			return new Promise((resolve) => {
				const req = indexedDB.open('hw-travel', 2);
				req.onsuccess = () => {
					const db = req.result;
					try {
						const tx = db.transaction('trips', 'readonly');
						const get = tx.objectStore('trips').get('trip-meta:portugal-spring-2027');
						get.onsuccess = () => resolve(Boolean(get.result));
						get.onerror = () => resolve(false);
					} catch { resolve(false); }
				};
				req.onerror = () => resolve(false);
			});
		}, { timeout: 3000 });

		const meta = await idbGetTripMeta(page, 'portugal-spring-2027');
		expect(meta).toBeTruthy();
		expect(meta.name).toBe('Portugal Spring 2027');
		// Seeded days Apr 10 through Apr 14 inclusive = 5 days
		const dayCount = await idbGetTripDayCount(page, 'portugal-spring-2027');
		expect(dayCount).toBe(5);
		const day0 = await idbGetTripDay(page, 'portugal-spring-2027', 0);
		const day4 = await idbGetTripDay(page, 'portugal-spring-2027', 4);
		expect(day0?.date).toBe('2027-04-10');
		expect(day4?.date).toBe('2027-04-14');

		await expect(page).toHaveURL(/\/trip\/portugal-spring-2027/, { timeout: 5000 });
	});

	test('Dismiss removes the action block without creating a trip', async ({ page }) => {
		await mockChatApiWithCreate(page);
		await navigateAuthenticated(page, '/trip/china-2026');

		await askAgentForNewTrip(page);

		const assistant = page.locator('.msg--assistant').first();
		await expect(assistant).toBeVisible({ timeout: 10000 });

		await assistant.locator('[aria-label="Dismiss new trip"]').click();

		await expect(assistant.locator('[aria-label="Create trip action"]')).not.toBeVisible({ timeout: 3000 });

		const meta = await idbGetTripMeta(page, 'portugal-spring-2027');
		expect(meta).toBeFalsy();
	});
});
