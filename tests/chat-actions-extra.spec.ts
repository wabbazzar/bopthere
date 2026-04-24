import { test, expect, type Page } from '@playwright/test';
import { idbGet } from './helpers/idb';

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
		localStorage.removeItem('hw-idb-migration-complete');
		localStorage.setItem('hw-auth-token', jwt);
		localStorage.setItem('hw-auth-user', JSON.stringify(user));
	}, TEST_USER);
}

async function primeTrip(page: Page) {
	// Block the real server so we drive state purely from localStorage
	await page.route('**/api/trips/**', async (route) => {
		await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
	});
	await injectAuth(page);
	// Seed a minimal china-2026 with two days + one existing link + one todo
	await page.evaluate(() => {
		const trip = {
			id: 'china-2026',
			name: 'China 2026',
			startDate: '2026-04-22',
			endDate: '2026-04-23',
			destinations: ['Shanghai'],
			links: ['https://original.example'],
			days: [
				{ date: '2026-04-22', dayOfWeek: 'Wed', location: 'Shanghai', travel: '', morning: '', afternoon: '', evening: '', accommodation: '', notes: '', ooo: false },
				{ date: '2026-04-23', dayOfWeek: 'Thu', location: 'Shanghai', travel: '', morning: '', afternoon: '', evening: '', accommodation: '', notes: '', ooo: false }
			]
		};
		localStorage.setItem('hw-trips', JSON.stringify({ 'china-2026': trip }));
		localStorage.setItem('hw-todos-schema-version', '2');
		localStorage.setItem('hw-trip-todos-china-2026', JSON.stringify([
			{ text: 'Existing task A', done: false },
			{ text: 'Existing task B', done: false }
		]));
	});
}

function mockChatApi(page: Page, assistantContent: string) {
	return Promise.all([
		page.route('**/api/chat/messages', async (route) => {
			await new Promise((r) => setTimeout(r, 150));
			await route.fulfill({
				status: 200, contentType: 'application/json',
				body: JSON.stringify({
					id: `mock-${Date.now()}`,
					role: 'assistant',
					content: assistantContent,
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

async function openChatAndSend(page: Page, userMsg: string) {
	await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(800);
	await page.locator('button[aria-label="Trip assistant"]').click();
	await expect(page.locator('.drawer')).toBeVisible({ timeout: 5000 });
	const input = page.locator('.drawer-input textarea');
	await input.click();
	await page.keyboard.type(userMsg);
	await page.waitForTimeout(150);
	await page.locator('.send-btn').click({ force: true });
	const assistant = page.locator('.msg--assistant').first();
	await expect(assistant).toBeVisible({ timeout: 10000 });
	return assistant;
}

test.describe('Chat action blocks — TRIP_DAYS', () => {
	test('Apply duplicates + adds days', async ({ page }) => {
		await primeTrip(page);
		await mockChatApi(page, `Adding two days.\n\n\`\`\`TRIP_DAYS\n[{"op":"duplicate","dayIndex":0},{"op":"add"}]\n\`\`\``);
		const assistant = await openChatAndSend(page, 'add two days');

		await expect(assistant.locator('[aria-label="Day reshape actions"]')).toBeVisible();
		await assistant.locator('[aria-label="Apply day changes"]').click();
		await expect(assistant.locator('[aria-label="Day changes applied"]')).toBeVisible();

		const trip = await idbGet(page, 'trips', 'china-2026');
		const dayCount = trip?.days?.length ?? null;
		// Started with 2, duplicate → 3, add → 4
		expect(dayCount).toBe(4);
	});

	test('Dismiss leaves days untouched', async ({ page }) => {
		await primeTrip(page);
		await mockChatApi(page, `OK.\n\n\`\`\`TRIP_DAYS\n[{"op":"delete","dayIndex":0}]\n\`\`\``);
		const assistant = await openChatAndSend(page, 'delete day 1');

		await assistant.locator('[aria-label="Dismiss day changes"]').click();
		await expect(assistant.locator('[aria-label="Day reshape actions"]')).not.toBeVisible();

		const trip = await idbGet(page, 'trips', 'china-2026');
		expect(trip?.days?.length).toBe(2);
	});
});

test.describe('Chat action blocks — TRIP_META', () => {
	test('Apply updates name + destinations', async ({ page }) => {
		await primeTrip(page);
		await mockChatApi(
			page,
			`Renaming.\n\n\`\`\`TRIP_META\n{"name":"China Spring 2026","destinations":["Shanghai","Chongqing","Zhangjiajie"]}\n\`\`\``
		);
		const assistant = await openChatAndSend(page, 'rename trip and add destinations');

		await expect(assistant.locator('[aria-label="Trip meta actions"]')).toBeVisible();
		await assistant.locator('[aria-label="Apply trip meta"]').click();
		await expect(assistant.locator('[aria-label="Trip meta applied"]')).toBeVisible();

		const stored = await idbGet(page, 'trips', 'china-2026');
		expect(stored.name).toBe('China Spring 2026');
		// Destinations are recomputed from day locations AFTER updateDestinations runs,
		// because trip.destinations is also derived in other store paths; here we set
		// it explicitly so it should include at least what we supplied. Store code
		// normalizes via computeDestinations on any day mutation but updateDestinations
		// overrides directly.
		expect(stored.destinations).toEqual(['Shanghai', 'Chongqing', 'Zhangjiajie']);
	});
});

test.describe('Chat action blocks — TRIP_LINKS', () => {
	test('Apply adds + updates + deletes links', async ({ page }) => {
		await primeTrip(page);
		// Start with one link ("https://original.example"). Agent: add a new one, then delete index 0.
		await mockChatApi(
			page,
			`OK.\n\n\`\`\`TRIP_LINKS\n[{"op":"add","url":"https://booking.com/hotel"},{"op":"delete","linkIndex":0}]\n\`\`\``
		);
		const assistant = await openChatAndSend(page, 'swap out our reference link');

		await expect(assistant.locator('[aria-label="Trip link actions"]')).toBeVisible();
		await assistant.locator('[aria-label="Apply link changes"]').click();
		await expect(assistant.locator('[aria-label="Link changes applied"]')).toBeVisible();

		const trip2 = await idbGet(page, 'trips', 'china-2026');
		// add first → links = [original, booking.com]; delete index 0 → [booking.com]
		expect(trip2.links).toEqual(['https://booking.com/hotel']);
	});
});

test.describe('Chat action blocks — TODOS', () => {
	test('Apply adds + toggles + deletes todos', async ({ page }) => {
		await primeTrip(page);
		// Existing: [A (undone), B (undone)]. Agent: add C, toggle A, delete B.
		await mockChatApi(
			page,
			`Updating todos.\n\n\`\`\`TODOS\n[{"op":"add","text":"Task C"},{"op":"toggle","todoIndex":0},{"op":"delete","todoIndex":1}]\n\`\`\``
		);
		const assistant = await openChatAndSend(page, 'clean up the todos');

		await expect(assistant.locator('[aria-label="Todo actions"]')).toBeVisible();
		await assistant.locator('[aria-label="Apply todo changes"]').click();
		await expect(assistant.locator('[aria-label="Todos applied"]')).toBeVisible();

		const todos = await idbGet(page, 'todos', 'china-2026');
		// Operations applied in order (0-indexed against the live store state at each step):
		// [A, B] → add C → [A, B, C]
		// → toggle idx 0 → [A(done), B, C]
		// → delete idx 1 → [A(done), C]
		expect(todos).toEqual([
			{ text: 'Existing task A', done: true },
			{ text: 'Task C', done: false }
		]);
	});
});
