import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const API = 'https://api.heatherandwesley.com';

const TEST_USER = {
	username: 'wesley',
	email: 'wesleybeckner@gmail.com',
	full_name: 'Wesley Beckner',
	role: 'admin'
};

async function injectAuth(page: Page): Promise<string> {
	await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
	return await page.evaluate(async (user) => {
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
}

test.describe('Bookings — backend-served with signed tickets', () => {
	test('bookings section renders data fetched from the FastAPI backend', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });

		// #bookings-section only mounts once the async fetch resolves
		await expect(page.locator('#bookings-section')).toBeVisible({ timeout: 8000 });
		// Entries for Austin → Shanghai should be present. We deliberately do
		// NOT assert on any confirmation codes or eTicket numbers here — those
		// are exactly the sensitive fields we moved out of the repo, and
		// hardcoding one in a test would re-leak it.
		await expect(page.locator('#bookings-section')).toContainText('Austin');
		await expect(page.locator('#bookings-section')).toContainText('Shanghai');
		const bookingCount = await page.locator('#bookings-section .booking').count();
		expect(bookingCount).toBeGreaterThanOrEqual(3);
	});

	test('bookings endpoint returns 401 without auth', async ({ request }) => {
		const res = await request.get(`${API}/api/trips/china-2026/bookings`);
		expect(res.status()).toBe(401);
	});

	test('clicking "View ticket" opens a signed-URL PDF', async ({ page, context }) => {
		const token = await injectAuth(page);
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await expect(page.locator('#bookings-section')).toBeVisible({ timeout: 8000 });

		// Expand the first booking (Austin → Shanghai) so the ticket link shows
		await page.locator('#bookings-section .booking').first().click();
		const ticketLink = page.locator('#bookings-section a.booking-ticket').first();
		await expect(ticketLink).toBeVisible({ timeout: 3000 });

		// Listen at the context level so we catch the popup's navigation request
		// regardless of how the popup frame resolves. Headless Chrome aborts
		// top-level PDF navigations (can't render inline), so page-level
		// waitForURL is unreliable here.
		const reqPromise = context.waitForEvent('request', (r) =>
			r.url().includes('/api/trips/china-2026/attachments/flight-aus-pvg-wesley.pdf') &&
			r.url().includes('sig=')
		);
		await ticketLink.click();
		const req = await reqPromise;
		const popupUrl = req.url();
		expect(popupUrl).toContain('exp=');

		// Hit the URL directly to confirm the PDF actually streams
		const direct = await page.request.get(popupUrl);
		expect(direct.status()).toBe(200);
		expect(direct.headers()['content-type']).toContain('application/pdf');
		const body = await direct.body();
		expect(body.length).toBeGreaterThan(100_000);
	});
});
