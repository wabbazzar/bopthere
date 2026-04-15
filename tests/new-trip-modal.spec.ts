import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';

const TEST_USER = {
	username: 'wesley',
	email: 'wesleybeckner@gmail.com',
	full_name: 'Wesley Beckner',
	role: 'admin'
};

async function injectAuth(page: Page): Promise<void> {
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

async function mountDashboard(page: Page) {
	// Block real API calls so localStorage-only flow is tested deterministically
	await page.route('**/api/trips/**', async (route) => {
		await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
	});
	await injectAuth(page);
	// Remove any leftover test trip so each run is deterministic
	await page.evaluate(() => {
		const raw = localStorage.getItem('hw-trips');
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw);
			for (const k of Object.keys(parsed)) {
				if (k.startsWith('japan-')) delete parsed[k];
			}
			localStorage.setItem('hw-trips', JSON.stringify(parsed));
		} catch {}
	});
	await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1000);
}

test.describe('New Trip Modal', () => {
	test('opens from dashboard and creates a trip via calendar range', async ({ page }) => {
		await mountDashboard(page);

		await page.locator('button[aria-label="Create a new trip"]').click();

		const dialog = page.locator('[role="dialog"]');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('heading', { name: 'New trip' })).toBeVisible();

		// Fill the name
		await dialog.locator('input[type="text"]').first().fill('Japan Maple Tour');

		// Navigate the calendar forward to a known month (pick somewhere in +6 months)
		// Just advance 6 months so we hit a reliably future month regardless of today's date.
		for (let i = 0; i < 6; i++) {
			await dialog.locator('button[aria-label="Next month"]').click();
		}

		// Click two day cells in that month — first available + some later one.
		// aria-label on each cell is the ISO date.
		const cells = dialog.locator('button[aria-label^="20"]');
		const firstCell = cells.first();
		await firstCell.click();

		// Pick a cell ~13 days later
		const laterCell = cells.nth(13);
		await laterCell.click();

		// Both should now be pressed (selected endpoints)
		await expect(dialog.locator('button[aria-pressed="true"]')).toHaveCount(2);

		// Summary text reports a day count
		await expect(dialog.locator('[aria-live="polite"]')).toContainText(/days/);

		// Submit
		await dialog.locator('button[type="submit"]').click();

		// URL should change to the new trip (slug derived from name)
		await expect(page).toHaveURL(/\/trip\/japan-maple-tour/, { timeout: 5000 });

		// The trip is in localStorage with the right name
		const stored = await page.evaluate(() => {
			const raw = localStorage.getItem('hw-trips');
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			const key = Object.keys(parsed).find((k) => k.startsWith('japan-maple-tour'));
			return key ? parsed[key] : null;
		});
		expect(stored).toBeTruthy();
		expect(stored.name).toBe('Japan Maple Tour');
		expect(Array.isArray(stored.days)).toBe(true);
		expect(stored.days.length).toBeGreaterThan(1);
	});

	test('submit button stays disabled until name + both dates are set', async ({ page }) => {
		await mountDashboard(page);
		await page.locator('button[aria-label="Create a new trip"]').click();

		const dialog = page.locator('[role="dialog"]');
		const submit = dialog.locator('button[type="submit"]');
		await expect(submit).toBeDisabled();

		await dialog.locator('input[type="text"]').first().fill('Japan');
		await expect(submit).toBeDisabled();

		// Pick only one date
		for (let i = 0; i < 6; i++) await dialog.locator('button[aria-label="Next month"]').click();
		await dialog.locator('button[aria-label^="20"]').first().click();
		await expect(submit).toBeDisabled();

		// Pick the end
		await dialog.locator('button[aria-label^="20"]').nth(5).click();
		await expect(submit).toBeEnabled();
	});

	test('destinations chips can be added and removed', async ({ page }) => {
		await mountDashboard(page);
		await page.locator('button[aria-label="Create a new trip"]').click();

		const dialog = page.locator('[role="dialog"]');
		// Expand optional section
		await dialog.locator('summary', { hasText: 'destinations' }).click();

		const tagInput = dialog.locator('input[aria-label="Add destination"]');
		await tagInput.fill('Tokyo');
		await tagInput.press('Enter');
		await tagInput.fill('Kyoto, Osaka');
		await tagInput.press('Enter');

		// One remove-button per tag
		const removeButtons = dialog.locator('button[aria-label^="Remove "]');
		await expect(removeButtons).toHaveCount(3);
		await expect(dialog.locator('button[aria-label="Remove Tokyo"]')).toBeVisible();
		await expect(dialog.locator('button[aria-label="Remove Kyoto"]')).toBeVisible();
		await expect(dialog.locator('button[aria-label="Remove Osaka"]')).toBeVisible();

		// Remove middle one
		await dialog.locator('button[aria-label="Remove Kyoto"]').click();
		await expect(removeButtons).toHaveCount(2);
		await expect(dialog.locator('button[aria-label="Remove Kyoto"]')).toHaveCount(0);
	});

	test('Escape key closes the modal', async ({ page }) => {
		await mountDashboard(page);
		await page.locator('button[aria-label="Create a new trip"]').click();
		await expect(page.locator('[role="dialog"]')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.locator('[role="dialog"]')).not.toBeVisible();
	});
});
