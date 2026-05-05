/**
 * Test: Authenticated user loading "/" should never see the login form.
 * Uses a MutationObserver to catch even single-frame flashes.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

const TEST_USER = {
	username: 'wesley',
	email: 'wesleybeckner@gmail.com',
	full_name: 'Wesley Beckner',
	role: 'admin'
};

/** Inject auth credentials into localStorage */
async function seedAuth(page: Page) {
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

test.describe('Auth Flash', () => {
	test('authenticated user never sees login form', async ({ page }) => {
		await seedAuth(page);

		// Inject a MutationObserver BEFORE the app renders.
		// It will record if a password input ever appears in the DOM.
		// NOTE: "Loading..." text is expected briefly during async IndexedDB hydration,
		// so we only check for the login form (password input) flashing.
		await page.addInitScript(() => {
			(window as any).__authFlashLog = [];
			const observer = new MutationObserver(() => {
				const passwordInput = document.querySelector('input[type="password"]');
				if (passwordInput) {
					(window as any).__authFlashLog.push({
						type: 'login-form',
						time: performance.now()
					});
				}
			});
			// Start observing as soon as the body exists
			if (document.body) {
				observer.observe(document.body, { childList: true, subtree: true });
			} else {
				document.addEventListener('DOMContentLoaded', () => {
					observer.observe(document.body, { childList: true, subtree: true });
				});
			}
		});

		// Navigate to "/" — this is the real test: a fresh page load with auth in localStorage
		await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

		// Wait for app to settle on dashboard
		await page.waitForURL('**/dashboard', { timeout: 10000 });
		await page.screenshot({ path: 'test-results/auth-flash-final.png' });

		// Check the MutationObserver log
		const flashLog = await page.evaluate(() => (window as any).__authFlashLog);

		const loginFlashes = flashLog.filter((e: any) => e.type === 'login-form');

		console.log('Flash log:', JSON.stringify(flashLog, null, 2));

		expect(loginFlashes.length, 'Login form should never appear for authenticated users').toBe(0);
	});

	test('unauthenticated user still sees login form', async ({ page }) => {
		// Clear any auth
		await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
		await page.evaluate(() => {
			localStorage.removeItem('hw-auth-token');
			localStorage.removeItem('hw-auth-user');
		});

		await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1000);

		// Login form should be visible
		await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
		await page.screenshot({ path: 'test-results/auth-flash-unauthed.png' });
	});
});
