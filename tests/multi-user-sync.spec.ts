/**
 * Multi-user sync integration tests.
 *
 * Simulates Wesley and Heather editing the same trip from different
 * "devices" (separate browser contexts with isolated localStorage).
 * Verifies that edits sync through the server and appear on the
 * other user's device after reload.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const API = 'https://api.bopthere.com';

const WESLEY = {
	username: 'wesley',
	email: 'wesleybeckner@gmail.com',
	full_name: 'Wesley Beckner',
	role: 'admin'
};

const HEATHER = {
	username: 'heather',
	email: 'heather@heatherandwesley.com',
	full_name: 'Heather',
	role: 'admin'
};

async function injectAuth(page: Page, user: typeof WESLEY) {
	await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
	await page.evaluate(async ({ user }) => {
		const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const payload = btoa(JSON.stringify({
			username: user.username, role: user.role,
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
		// Clear stale trip data so we get a clean pull from server
		localStorage.removeItem('hw-trips');
		localStorage.removeItem('hw-trips-meta');
		localStorage.removeItem('hw-trips-sync-pending');
	}, { user });
}

/** Navigate to trip page and wait for server data to load */
async function goToTrip(page: Page) {
	await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
	// Wait for the async server pull to complete and re-render
	await page.waitForTimeout(3000);
}

/** Switch to Day view and navigate to a specific date (e.g. '04-28') */
async function goToDay(page: Page, dateSuffix: string) {
	await page.locator('button[role="tab"]:has-text("Day")').click();
	await page.waitForTimeout(300);
	for (let pass = 0; pass < 2; pass++) {
		for (let i = 0; i < 12; i++) {
			const text = await page.locator('main').textContent();
			if (text && text.includes(dateSuffix)) return;
			const btn = page.locator(
				pass === 0 ? 'button[aria-label="Previous day"]' : 'button[aria-label="Next day"]'
			);
			if (!await btn.isEnabled()) break;
			await btn.click();
			await page.waitForTimeout(200);
		}
	}
}

/**
 * Edit a day field by label (Morning, Afternoon, Evening, etc.).
 * Clicks the field-text in the matching row, fills the input, presses Enter.
 */
async function editFieldByLabel(page: Page, label: string, newText: string) {
	// ExpandableField renders: .field-label (contains "Morning") + .field-value > .field-text
	// Locate the row that has this label, then click its .field-text
	const row = page.locator('.field-row', { has: page.locator(`.field-label:has-text("${label}")`) });
	await row.locator('.field-text').click();
	await page.waitForTimeout(200);
	const input = row.locator('.input-themed:visible').first();
	await input.fill(newText);
	await input.press('Enter');
	// Wait for the debounced sync to fire (2s debounce + network)
	await page.waitForTimeout(3500);
}

test.describe('Multi-user trip sync', () => {
	let tripSnapshot: unknown;
	let daySnapshots: { dayIndex: number; day: unknown; version: number }[] = [];
	let snapshotToken: string;

	/** Day indices that tests edit (04-28 = day 6, 04-29 = day 7, 04-30 = day 8) */
	const EDITED_DAY_INDICES = [6, 7, 8];

	/** Generate a JWT for API calls outside the browser context */
	async function getApiToken(browser: any): Promise<string> {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
		const token = await page.evaluate(async () => {
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
			return `${header}.${payload}.${signature}`;
		});
		await ctx.close();
		return token;
	}

	test.beforeAll(async ({ browser }) => {
		snapshotToken = await getApiToken(browser);
		const headers = { Authorization: `Bearer ${snapshotToken}` };

		// Snapshot the bulk trip so we can restore after tests
		const res = await fetch(`${API}/api/trips/china-2026`, { headers });
		if (res.ok) {
			const data = await res.json();
			tripSnapshot = data.trip;
		}

		// Snapshot per-entry day data for every day the tests will edit
		for (const idx of EDITED_DAY_INDICES) {
			const dayRes = await fetch(`${API}/api/trips/china-2026/days/${idx}`, { headers });
			if (dayRes.ok) {
				const data = await dayRes.json();
				daySnapshots.push({ dayIndex: idx, day: data.day, version: data.version });
			}
		}
	});

	test.afterAll(async () => {
		if (!snapshotToken) return;
		const headers = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${snapshotToken}`
		};

		// Restore the bulk trip data
		if (tripSnapshot) {
			await fetch(`${API}/api/trips/china-2026`, {
				method: 'PUT',
				headers,
				body: JSON.stringify({
					trip: tripSnapshot,
					updatedAt: new Date().toISOString()
				})
			});
		}

		// Restore per-entry day data (these are written by the UI independently)
		for (const snap of daySnapshots) {
			// Fetch current version so the PUT doesn't get rejected by version conflict
			const cur = await fetch(`${API}/api/trips/china-2026/days/${snap.dayIndex}`, {
				headers: { Authorization: `Bearer ${snapshotToken}` }
			});
			const curVersion = cur.ok ? (await cur.json()).version : snap.version;
			await fetch(`${API}/api/trips/china-2026/days/${snap.dayIndex}`, {
				method: 'PUT',
				headers,
				body: JSON.stringify({ day: snap.day, version: curVersion })
			});
		}
	});

	test('Heather edits day 7, Wesley sees the change on reload', async ({ browser }) => {
		// Heather's device (separate browser context = separate localStorage)
		const heatherCtx = await browser.newContext();
		const heatherPage = await heatherCtx.newPage();
		await injectAuth(heatherPage, HEATHER);
		await goToTrip(heatherPage);
		await goToDay(heatherPage, '04-28');

		// Verify current morning content
		let content = await heatherPage.locator('main').textContent();
		expect(content).toContain('Tianzi Mountain');

		// Heather edits day 7 morning
		await editFieldByLabel(heatherPage, 'Morning', 'HEATHER EDIT: Early morning hike to Tianzi Mountain viewpoint');

		// Verify edit took locally
		content = await heatherPage.locator('main').textContent();
		expect(content).toContain('HEATHER EDIT');

		await heatherCtx.close();

		// Wesley's device (completely separate context)
		const wesleyCtx = await browser.newContext();
		const wesleyPage = await wesleyCtx.newPage();
		await injectAuth(wesleyPage, WESLEY);
		await goToTrip(wesleyPage);
		await goToDay(wesleyPage, '04-28');

		// Wesley should see Heather's edit pulled from the server
		content = await wesleyPage.locator('main').textContent();
		expect(content).toContain('HEATHER EDIT');

		await wesleyCtx.close();
	});

	test('Wesley edits day 8, Heather sees the change on reload', async ({ browser }) => {
		// Wesley's device
		const wesleyCtx = await browser.newContext();
		const wesleyPage = await wesleyCtx.newPage();
		await injectAuth(wesleyPage, WESLEY);
		await goToTrip(wesleyPage);
		await goToDay(wesleyPage, '04-29');

		let content = await wesleyPage.locator('main').textContent();
		expect(content).toContain('Glass Bridge');

		// Wesley edits day 8 afternoon
		await editFieldByLabel(wesleyPage, 'Afternoon', 'WESLEY EDIT: Tianmen Mountain via cable car, skip the 999 steps');

		content = await wesleyPage.locator('main').textContent();
		expect(content).toContain('WESLEY EDIT');

		await wesleyCtx.close();

		// Heather's device
		const heatherCtx = await browser.newContext();
		const heatherPage = await heatherCtx.newPage();
		await injectAuth(heatherPage, HEATHER);
		await goToTrip(heatherPage);
		await goToDay(heatherPage, '04-29');

		// Heather should see Wesley's edit
		content = await heatherPage.locator('main').textContent();
		expect(content).toContain('WESLEY EDIT');

		await heatherCtx.close();
	});

	test('sequential edits by both users preserve all changes', async ({ browser }) => {
		// Heather edits day 9 morning
		const heatherCtx1 = await browser.newContext();
		const heatherPage1 = await heatherCtx1.newPage();
		await injectAuth(heatherPage1, HEATHER);
		await goToTrip(heatherPage1);
		await goToDay(heatherPage1, '04-30');

		await editFieldByLabel(heatherPage1, 'Morning', 'HEATHER MORNING: Sleep in, hotel breakfast at Shanghai EDITION');
		await heatherCtx1.close();

		// Wesley loads, sees Heather's edit, then edits evening on same day
		const wesleyCtx = await browser.newContext();
		const wesleyPage = await wesleyCtx.newPage();
		await injectAuth(wesleyPage, WESLEY);
		await goToTrip(wesleyPage);
		await goToDay(wesleyPage, '04-30');

		// Verify Wesley sees Heather's morning edit
		let content = await wesleyPage.locator('main').textContent();
		expect(content).toContain('HEATHER MORNING');

		// Wesley edits a DIFFERENT field on the same day (evening)
		// Since we use whole-trip LWW, Wesley's save includes Heather's morning edit
		// because he pulled it on load. So Heather's edit should survive.
		await editFieldByLabel(wesleyPage, 'Evening', 'WESLEY EVENING: Pack for flight home');

		await wesleyCtx.close();

		// Heather reloads — should see BOTH her morning edit AND Wesley's evening edit
		const heatherCtx2 = await browser.newContext();
		const heatherPage2 = await heatherCtx2.newPage();
		await injectAuth(heatherPage2, HEATHER);
		await goToTrip(heatherPage2);
		await goToDay(heatherPage2, '04-30');

		content = await heatherPage2.locator('main').textContent();
		expect(content).toContain('HEATHER MORNING');
		expect(content).toContain('WESLEY EVENING');

		await heatherCtx2.close();
	});
});
