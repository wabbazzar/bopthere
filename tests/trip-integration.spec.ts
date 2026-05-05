/**
 * Trip Integration Tests — Real browser tests that click buttons,
 * edit fields, and verify the DOM actually changes.
 *
 * These are NOT unit tests. They drive a real browser against the real app.
 * If Add/Copy/Delete buttons don't work, these tests FAIL.
 * If field editing doesn't persist, these tests FAIL.
 *
 * IMPORTANT: Svelte 5 scopes CSS classes, so NEVER use class-based selectors
 * like .day-nav or .field-row. Use aria labels, roles, text content, and
 * data-testid attributes instead.
 *
 * Run: npx playwright test trip-integration.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5174';
const API = 'https://api.bopthere.com';

/** Forge a JWT for direct API calls (same secret as dev server) */
async function forgeApiToken(): Promise<string> {
	const crypto = await import('crypto');
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify({
		username: 'wesley', role: 'admin',
		exp: Math.floor(Date.now() / 1000) + 86400,
		iat: Math.floor(Date.now() / 1000)
	})).toString('base64url');
	const sig = crypto.createHmac('sha256', 'your-secret-key-change-in-production')
		.update(`${header}.${payload}`).digest('base64url');
	return `${header}.${payload}.${sig}`;
}

/** Snapshot a specific day from the server; returns { day, version } or null */
async function snapshotDay(token: string, tripId: string, dayIndex: number) {
	const res = await fetch(`${API}/api/trips/${tripId}/days/${dayIndex}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) return null;
	return await res.json();
}

/** Restore a day snapshot to the server, fetching the current version first */
async function restoreDay(token: string, tripId: string, dayIndex: number, dayData: unknown) {
	const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
	const cur = await fetch(`${API}/api/trips/${tripId}/days/${dayIndex}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!cur.ok) return;
	const { version } = await cur.json();
	const res = await fetch(`${API}/api/trips/${tripId}/days/${dayIndex}`, {
		method: 'PUT', headers,
		body: JSON.stringify({ day: dayData, version })
	});
	if (!res.ok) {
		console.error(`[trip-integration] Failed to restore day ${dayIndex}: ${res.status}`);
	}
}

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

/** Reset trip data to defaults via localStorage + IndexedDB (must call after injectAuth) */
async function resetTripData(page: Page) {
	await page.evaluate(async () => {
		localStorage.removeItem('hw-trips');
		localStorage.removeItem('hw-trip-view-china-2026');
		localStorage.removeItem('hw-trip-todos-china-2026');
		localStorage.removeItem('hw-idb-migration-complete');
		// Delete the IndexedDB entirely — the app will recreate it on next load
		await new Promise<void>((resolve) => {
			const req = indexedDB.deleteDatabase('hw-travel');
			req.onsuccess = () => resolve();
			req.onerror = () => resolve();
			req.onblocked = () => resolve();
		});
	});
}

/** Navigate to trip page in day view */
async function goToDayView(page: Page, targetDay?: number) {
	// Arm the listener before navigation so we don't miss the initSync GET
	const serverPullDone = page.waitForResponse(
		(r) =>
			r.url().includes('/api/trips/china-2026') &&
			!r.url().includes('/todos') &&
			!r.url().includes('/bookings') &&
			r.request().method() === 'GET',
		{ timeout: 10000 }
	).catch(() => null);
	await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1', { timeout: 10000 });
	await serverPullDone; // ensure server truth is applied before we start editing
	// Click the "Day" tab
	await page.getByRole('tab', { name: 'Day' }).click();
	await page.waitForSelector('button[aria-label="Next day"]', { timeout: 5000 });
	// Navigate to a specific day if requested (click the mini-calendar button)
	if (targetDay !== undefined) {
		await page.locator(`button[aria-label="Go to day ${targetDay}"]`).click();
		await page.waitForTimeout(300);
	}
}

/** Navigate to trip page in week view */
async function goToWeekView(page: Page) {
	await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1', { timeout: 10000 });
	await page.getByRole('tab', { name: 'Week' }).click();
	await page.waitForSelector('button:has-text("+ Add day")', { timeout: 5000 });
}

/** Get the "Day X of Y" text content */
async function getDayInfo(page: Page) {
	// The subtitle shows "Day X of Y" — find it by text pattern
	const subtitle = page.locator('text=/Day \\d+ of \\d+/');
	const text = await subtitle.textContent();
	const match = text!.match(/Day (\d+) of (\d+)/);
	return { current: parseInt(match![1]), total: parseInt(match![2]) };
}

/** Get the day title text (e.g., "Wed 04-22 · Shanghai") */
async function getDayTitle(page: Page) {
	// The nav title is between the prev/next buttons
	const prevBtn = page.locator('button[aria-label="Previous day"]');
	const nextBtn = page.locator('button[aria-label="Next day"]');
	// The title is the sibling between these buttons
	const titleArea = prevBtn.locator('..').locator('>> div').first();
	return await titleArea.textContent();
}

// ─── DAY VIEW: NAVIGATION ──────────────────────────────────────

test.describe('Day View — Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Previous/Next arrows navigate between days', async ({ page }) => {
		await goToDayView(page, 1);

		const { current: initial } = await getDayInfo(page);
		expect(initial).toBe(1);

		await page.click('button[aria-label="Next day"]');
		const { current: afterNext } = await getDayInfo(page);
		expect(afterNext).toBe(2);

		await page.click('button[aria-label="Previous day"]');
		const { current: afterPrev } = await getDayInfo(page);
		expect(afterPrev).toBe(1);
	});

	test('Previous button is disabled on first day', async ({ page }) => {
		await goToDayView(page, 1);
		await expect(page.locator('button[aria-label="Previous day"]')).toBeDisabled();
	});

	test('OOO toggle flips badge', async ({ page }) => {
		await goToDayView(page);

		// Day 1 (Shanghai) starts with ooo=false
		const oooBtn = page.getByRole('button', { name: /OOO/ });
		await oooBtn.click();

		// After click, should contain the "OOO" badge (bold/highlighted version)
		// The component renders either a badge-warn span or a faint text
		// We check the button contains a span with "OOO" text that is styled as a badge
		await expect(oooBtn.locator('span').first()).toBeVisible();
		const badgeText = await oooBtn.locator('span').first().textContent();
		expect(badgeText).toContain('OOO');

		// Click again to toggle off
		await oooBtn.click();
		await page.waitForTimeout(200);
	});
});

// ─── FIELD EDITING (ExpandableField) ────────────────────────────

test.describe('Field Editing — Tap to edit', () => {
	let _apiToken: string;
	const _daySnapshots: Map<number, unknown> = new Map();

	test.beforeAll(async () => {
		_apiToken = await forgeApiToken();
		// Snapshot ALL days since goToDayView() defaults to today-index (last day for ended trips)
		for (let i = 0; i < 12; i++) {
			const snap = await snapshotDay(_apiToken, 'china-2026', i);
			if (snap) _daySnapshots.set(i, snap.day);
		}
	});

	test.afterAll(async () => {
		if (!_apiToken) return;
		for (const [idx, dayData] of _daySnapshots) {
			await restoreDay(_apiToken, 'china-2026', idx, dayData);
		}
	});

	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Tap on a field opens edit input', async ({ page }) => {
		await goToDayView(page);

		// Find a field by its label then double-click the value area
		// The Notes field has title="Tap to edit"
		const editableFields = page.locator('[title="Tap to edit"]');
		const notesField = editableFields.last();
		await notesField.click();

		// An input should appear within the field area
		const editInput = page.locator('input[type="text"]').first();
		await expect(editInput).toBeVisible();
	});

	test('Editing a field and pressing Enter saves the value', async ({ page }) => {
		await goToDayView(page);

		// Tap the Travel field (has "Land at 5PM" on day 1)
		const travelField = page.locator('[title="Tap to edit"]').first();
		const originalTravel = (await travelField.textContent())!.trim();
		await travelField.click();

		const editInput = page.locator('input[type="text"]').first();
		await editInput.fill('NEW TRAVEL VALUE 12345');
		await editInput.press('Enter');

		// Verify the value persisted in the DOM
		await expect(page.locator('text=NEW TRAVEL VALUE 12345')).toBeVisible();

		// Restore original value so test data doesn't leak to the server
		await page.locator('text=NEW TRAVEL VALUE 12345').click();
		const restoreInput = page.locator('input[type="text"]').first();
		await restoreInput.fill(originalTravel);
		await restoreInput.press('Enter');
	});

	test('Editing a field and pressing Escape cancels without saving', async ({ page }) => {
		await goToDayView(page);

		// Get initial travel text
		const travelField = page.locator('[title="Tap to edit"]').first();
		const originalText = await travelField.textContent();

		await travelField.click();
		const editInput = page.locator('input[type="text"]').first();
		await editInput.fill('SHOULD NOT SAVE');
		await editInput.press('Escape');

		// Value should revert to original
		await expect(page.locator('[title="Tap to edit"]').first()).toContainText(originalText!.trim());
	});

	test('Edited field value persists after navigating away and back', async ({ page }) => {
		await goToDayView(page);

		// Edit the Notes field on Day 1 (last editable field)
		const notesField = page.locator('[title="Tap to edit"]').last();
		const originalNotes = (await notesField.textContent())!.trim();
		await notesField.click();
		const editInput = page.locator('input[type="text"]').first();
		await editInput.fill('PERSISTENT NOTE ABCDE');
		await editInput.press('Enter');

		// Navigate to Day 2
		await page.click('button[aria-label="Next day"]');
		await page.waitForTimeout(300);

		// Navigate back to Day 1
		await page.click('button[aria-label="Previous day"]');
		await page.waitForTimeout(300);

		// Value should still be there
		await expect(page.locator('text=PERSISTENT NOTE ABCDE')).toBeVisible();

		// Restore original value so test data doesn't leak to the server
		await page.locator('text=PERSISTENT NOTE ABCDE').click();
		const restoreInput = page.locator('input[type="text"]').first();
		await restoreInput.fill(originalNotes || '—');
		await restoreInput.press('Enter');
	});

	test('Edited field value persists after full page reload', async ({ page }) => {
		await goToDayView(page);

		// Capture original notes value before editing
		const notesField = page.locator('[title="Tap to edit"]').last();
		const originalNotes = (await notesField.textContent())!.trim();

		// Edit notes field
		await notesField.click();
		const editInput = page.locator('input[type="text"]').first();
		await editInput.fill('SURVIVES RELOAD XYZ');
		await editInput.press('Enter');
		// Wait for the debounced server sync to fire (2s debounce + margin)
		await page.waitForTimeout(2500);

		// Full page reload
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.waitForSelector('h1', { timeout: 10000 });
		// Switch back to day view
		await page.getByRole('tab', { name: 'Day' }).click();
		await page.waitForSelector('button[aria-label="Next day"]', { timeout: 5000 });

		// Notes field should still have our value
		await expect(page.locator('text=SURVIVES RELOAD XYZ')).toBeVisible();

		// Restore original value so test data doesn't pollute the real trip
		await page.locator('text=SURVIVES RELOAD XYZ').click();
		const restoreInput = page.locator('input[type="text"]').first();
		await restoreInput.fill(originalNotes || '—');
		await restoreInput.press('Enter');
		// Wait for server sync before test teardown
		await page.waitForTimeout(2500);
	});
});

// ─── DAY-NAV LOCATION — inline tap-to-edit in the day header ─────

test.describe('Day-nav location — tap to edit', () => {
	let _apiToken: string;
	const _daySnapshots: Map<number, unknown> = new Map();

	test.beforeAll(async () => {
		_apiToken = await forgeApiToken();
		for (let i = 0; i < 12; i++) {
			const snap = await snapshotDay(_apiToken, 'china-2026', i);
			if (snap) _daySnapshots.set(i, snap.day);
		}
	});

	test.afterAll(async () => {
		if (!_apiToken) return;
		for (const [idx, dayData] of _daySnapshots) {
			await restoreDay(_apiToken, 'china-2026', idx, dayData);
		}
	});

	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Tapping the location text in day-nav opens an editor and saves', async ({ page }) => {
		await goToDayView(page);

		const locBtn = page.getByRole('button', { name: 'Edit location' });
		await expect(locBtn).toBeVisible();

		await locBtn.click();
		const input = page.getByRole('textbox', { name: 'Edit location' });
		await expect(input).toBeVisible();

		await input.fill('Edited Location ZZZ');
		await input.press('Enter');

		// Button comes back with the new value
		await expect(page.getByRole('button', { name: 'Edit location' })).toContainText('Edited Location ZZZ');
		// And the inline Location row in the day card mirrors the change
		await expect(page.locator('text=Edited Location ZZZ').first()).toBeVisible();
	});

	test('Empty-state "No location" placeholder also taps to edit', async ({ page }) => {
		await goToDayView(page);

		// Clear the location first (so we get the "No location" placeholder)
		const locBtn = page.getByRole('button', { name: 'Edit location' });
		await locBtn.click();
		let input = page.getByRole('textbox', { name: 'Edit location' });
		await input.fill('');
		await input.press('Enter');

		// Button should now read "No location"
		const placeholder = page.getByRole('button', { name: 'Edit location' });
		await expect(placeholder).toContainText('No location');

		// Tapping it should still open the editor
		await placeholder.click();
		input = page.getByRole('textbox', { name: 'Edit location' });
		await input.fill('Brand New City');
		await input.press('Enter');
		await expect(page.getByRole('button', { name: 'Edit location' })).toContainText('Brand New City');
	});

	test('Escape cancels the day-nav location edit', async ({ page }) => {
		await goToDayView(page);

		const locBtn = page.getByRole('button', { name: 'Edit location' });
		const original = (await locBtn.textContent())?.trim();

		await locBtn.click();
		const input = page.getByRole('textbox', { name: 'Edit location' });
		await input.fill('SHOULD NOT SAVE');
		await input.press('Escape');

		await expect(page.getByRole('button', { name: 'Edit location' })).toContainText(original!);
	});

	test('Edited day-nav location persists after navigating away and back', async ({ page }) => {
		await goToDayView(page);
		// Let the initial server pull settle so it can't race-overwrite our edit.
		await page.waitForLoadState('networkidle');

		const locBtn = page.getByRole('button', { name: 'Edit location' });
		await locBtn.click();
		const input = page.getByRole('textbox', { name: 'Edit location' });
		await input.fill('Persisted City 7');
		await input.press('Enter');

		await page.click('button[aria-label="Next day"]');
		await page.waitForTimeout(200);
		await page.click('button[aria-label="Previous day"]');
		await page.waitForTimeout(200);

		await expect(page.getByRole('button', { name: 'Edit location' })).toContainText('Persisted City 7');
	});
});

// ─── MINI-CAL — weekday-aligned grid (Mon–Sun) ───────────────────

test.describe('MiniCalendar — Mon–Sun weekday alignment', () => {
	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Renders M T W T F S S headers in order', async ({ page }) => {
		await goToDayView(page);
		const headers = page.locator('[data-testid="mini-cal-headers"] > *');
		await expect(headers).toHaveCount(7);
		await expect(headers.nth(0)).toHaveText('M');
		await expect(headers.nth(1)).toHaveText('T');
		await expect(headers.nth(2)).toHaveText('W');
		await expect(headers.nth(3)).toHaveText('T');
		await expect(headers.nth(4)).toHaveText('F');
		await expect(headers.nth(5)).toHaveText('S');
		await expect(headers.nth(6)).toHaveText('S');
	});

	test('Each week row has exactly 7 columns', async ({ page }) => {
		await goToDayView(page);
		const weeks = page.locator('[data-testid="mini-cal-week"]');
		const count = await weeks.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const cells = weeks.nth(i).locator(':scope > *');
			await expect(cells).toHaveCount(7);
		}
	});

	test('Day 1 sits in the column matching its weekday (Mon=0..Sun=6)', async ({ page }) => {
		await goToDayView(page);
		const firstWeek = page.locator('[data-testid="mini-cal-week"]').first();
		const cells = firstWeek.locator(':scope > *');
		await expect(cells).toHaveCount(7);

		// Read the weekday off day 1's title (e.g. "Wed 04-22 · Shanghai")
		const day1 = page.locator('[aria-label="Go to day 1"]');
		const title = (await day1.getAttribute('title')) || '';
		const weekdayAbbr = title.split(' ')[0];
		const monIdx: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
		const expectedCol = monIdx[weekdayAbbr];
		expect(expectedCol).toBeGreaterThanOrEqual(0);

		// Cells before day 1 must all be blanks
		for (let i = 0; i < expectedCol; i++) {
			await expect(cells.nth(i)).toHaveAttribute('data-testid', 'mini-cal-blank');
		}
		// Day 1 sits at the expected column
		await expect(cells.nth(expectedCol)).toHaveAttribute('aria-label', 'Go to day 1');
	});

	test('Trailing blanks pad the final week to 7 cells', async ({ page }) => {
		await goToDayView(page);
		const weeks = page.locator('[data-testid="mini-cal-week"]');
		const lastWeek = weeks.last();
		const cells = lastWeek.locator(':scope > *');
		await expect(cells).toHaveCount(7);
	});
});

// ─── TRIP HEADER — Undo / Export / Reset / Name Edit ────────────

test.describe('Trip Header — Undo, Export, Reset, Name Edit', () => {
	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Tap trip name opens editor, Enter saves', async ({ page }) => {
		await goToDayView(page);

		const tripName = page.locator('h1');
		const originalName = await tripName.textContent();
		await tripName.click();

		// Input should appear (the name editor has no specific role, find by context)
		const nameInput = page.locator('input[type="text"]').first();
		await expect(nameInput).toBeVisible();

		await nameInput.fill('Test Trip Name 999');
		await nameInput.press('Enter');

		await expect(page.locator('h1')).toContainText('Test Trip Name 999');

		// Undo lives in the Trip actions menu now — open it first
		await page.getByRole('button', { name: 'Trip actions' }).click();
		await page.getByRole('menuitem', { name: 'Undo' }).click();
		await expect(page.locator('h1')).toContainText(originalName!.trim());
	});

	test('Reset button reverts all changes after confirmation', async ({ page }) => {
		await goToDayView(page);

		const tripName = page.locator('h1');
		const originalName = await tripName.textContent();
		await tripName.click();
		const nameInput = page.locator('input[type="text"]').first();
		await nameInput.fill('CHANGED NAME');
		await nameInput.press('Enter');
		await expect(page.locator('h1')).toContainText('CHANGED NAME');

		// Reset lives in the Trip actions menu now — open it first
		await page.getByRole('button', { name: 'Trip actions' }).click();
		// Set up dialog handler BEFORE clicking reset
		page.once('dialog', dialog => dialog.accept());
		await page.getByRole('menuitem', { name: 'Reset' }).click();
		// Wait for Svelte reactivity to process the reset
		await page.waitForTimeout(500);

		await expect(page.locator('h1')).toContainText(originalName!.trim(), { timeout: 5000 });
	});

	test('Export button triggers file download', async ({ page }) => {
		await goToDayView(page);

		// Export lives in the Trip actions menu now — open it first
		await page.getByRole('button', { name: 'Trip actions' }).click();
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('menuitem', { name: 'Export' }).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('china-2026.json');
	});
});

// ─── WEEK VIEW → DAY VIEW FLOW ─────────────────────────────────

test.describe('Week View — Day Card Interaction', () => {
	let _apiToken: string;
	let _tripSnapshot: unknown;

	test.beforeAll(async () => {
		_apiToken = await forgeApiToken();
		const res = await fetch(`${API}/api/trips/china-2026`, {
			headers: { Authorization: `Bearer ${_apiToken}` }
		});
		if (res.ok) _tripSnapshot = (await res.json()).trip;
	});

	test.afterAll(async () => {
		if (_apiToken && _tripSnapshot) {
			await fetch(`${API}/api/trips/china-2026`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_apiToken}` },
				body: JSON.stringify({ trip: _tripSnapshot, updatedAt: new Date().toISOString() })
			});
		}
	});

	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Clicking a day card switches to day view for that day', async ({ page }) => {
		await goToWeekView(page);

		// Day cards have cursor=pointer and contain date info like "Wed 04-22"
		const firstDayCard = page.locator('[cursor="pointer"]').first();
		// More reliable: click the first card text showing a date
		await page.locator('text=/\\w{3} \\d{2}-\\d{2}/').first().click();

		// Should now be in day view — verify by presence of Next/Prev buttons
		await expect(page.locator('button[aria-label="Next day"]')).toBeVisible({ timeout: 5000 });
		const { current } = await getDayInfo(page);
		expect(current).toBe(1);
	});

	test('Week view shows correct number of day cards', async ({ page }) => {
		await goToWeekView(page);

		// Count elements that contain date patterns like "Wed 04-22"
		const dayLabels = page.locator('text=/^\\w{3} \\d{2}-\\d{2}$/');
		const count = await dayLabels.count();
		expect(count).toBeGreaterThan(0);

		// Should match the "X days" label
		const daysText = await page.locator('text=/\\d+ days/').textContent();
		const expectedCount = parseInt(daysText!.match(/(\d+)/)![1]);
		expect(count).toBe(expectedCount);
	});

	test('Add Day in week view adds a card', async ({ page }) => {
		await goToWeekView(page);

		const dayLabels = page.locator('text=/^\\w{3} \\d{2}-\\d{2}$/');
		const initialCount = await dayLabels.count();

		await page.getByRole('button', { name: '+ Add day' }).click();

		const newCount = await dayLabels.count();
		expect(newCount).toBe(initialCount + 1);
	});
});

// ─── VIEW TOGGLE ────────────────────────────────────────────────

test.describe('View Toggle', () => {
	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Week/Day toggle switches views', async ({ page }) => {
		await page.goto(`${BASE_URL}/trip/china-2026`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('h1', { timeout: 10000 });

		// Click Day tab
		await page.getByRole('tab', { name: 'Day' }).click();
		await expect(page.locator('button[aria-label="Next day"]')).toBeVisible({ timeout: 5000 });

		// Click Week tab
		await page.getByRole('tab', { name: 'Week' }).click();
		await expect(page.getByRole('button', { name: '+ Add day' })).toBeVisible({ timeout: 5000 });
	});
});

// ─── TODOS SECTION ──────────────────────────────────────────────

test.describe('Todos Section', () => {
	test.beforeEach(async ({ page }) => {
		await injectAuth(page);
		await resetTripData(page);
	});

	test('Add a todo item', async ({ page }) => {
		await goToDayView(page);

		await page.getByPlaceholder('Add a task...').fill('Pack passport');
		await page.getByRole('button', { name: 'Add', exact: true }).click();

		await expect(page.locator('text=Pack passport')).toBeVisible();
	});

	test('Toggle todo checkbox marks item done', async ({ page }) => {
		await goToDayView(page);

		// Add a todo first (server has none for a clean trip)
		await page.getByPlaceholder('Add a task...').fill('Toggle test item');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.locator('text=Toggle test item')).toBeVisible();

		const firstCheckbox = page.getByRole('checkbox').first();
		await firstCheckbox.check();
		expect(await firstCheckbox.isChecked()).toBe(true);

		await firstCheckbox.uncheck();
		expect(await firstCheckbox.isChecked()).toBe(false);
	});

	test('Delete todo removes it from list', async ({ page }) => {
		await goToDayView(page);

		// Add two todos first (server has none for a clean trip)
		await page.getByPlaceholder('Add a task...').fill('Delete test item 1');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await page.getByPlaceholder('Add a task...').fill('Delete test item 2');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.locator('text=Delete test item 2')).toBeVisible();

		// Count todos via checkboxes (only todos have checkboxes)
		const checkboxes = page.getByRole('checkbox');
		const initialCount = await checkboxes.count();
		expect(initialCount).toBeGreaterThan(0);

		// The ✕ delete buttons are opacity:0 until hover — use dispatchEvent to bypass
		const firstDeleteBtn = page.locator('button').filter({ hasText: '\u2715' }).first();
		await firstDeleteBtn.dispatchEvent('click');

		await page.waitForTimeout(300);
		const newCount = await checkboxes.count();
		expect(newCount).toBe(initialCount - 1);
	});

	test('Tap todo text to edit', async ({ page }) => {
		await goToDayView(page);

		// Add a todo first (server has none for a clean trip)
		await page.getByPlaceholder('Add a task...').fill('Edit test item');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.locator('text=Edit test item')).toBeVisible();

		// Todo items have title="Tap to edit"
		const firstTodo = page.locator('ul li [title="Tap to edit"]').first();
		await firstTodo.click();

		const editInput = page.locator('ul li input[type="text"]');
		await expect(editInput).toBeVisible();

		await editInput.fill('EDITED TODO ITEM');
		await editInput.press('Enter');

		await expect(page.locator('text=EDITED TODO ITEM')).toBeVisible();
	});

	test('Add todo via Enter key', async ({ page }) => {
		await goToDayView(page);

		await page.getByPlaceholder('Add a task...').fill('Buy souvenirs');
		await page.getByPlaceholder('Add a task...').press('Enter');

		await expect(page.locator('text=Buy souvenirs')).toBeVisible();
	});
});

// ─── DASHBOARD → TRIP FLOW ──────────────────────────────────────

test.describe('Dashboard — Trip Navigation', () => {
	test('Dashboard shows at least one trip card', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(2000);

		const tripLinks = page.locator('a[href*="/trip/"]');
		await expect(tripLinks.first()).toBeVisible({ timeout: 5000 });
		expect(await tripLinks.count()).toBeGreaterThanOrEqual(1);
	});

	test('Clicking trip card navigates to trip page', async ({ page }) => {
		await injectAuth(page);
		await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(2000);

		await page.locator('a[href*="/trip/"]').first().click();
		await page.waitForURL('**/trip/**', { timeout: 5000 });
		await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
	});
});

// ─── CONSOLE ERRORS ─────────────────────────────────────────────

test.describe('No JavaScript Errors', () => {
	test('Trip page has no console errors during interaction', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', msg => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await injectAuth(page);
		await goToDayView(page);

		// Click through actions
		// Navigate between days — start at day 1 so "Next day" is always enabled
		await page.locator('button[aria-label="Go to day 1"]').click();
		await page.waitForTimeout(200);
		await page.click('button[aria-label="Next day"]');
		await page.click('button[aria-label="Next day"]');
		await page.click('button[aria-label="Previous day"]');

		// Edit a field
		const editableField = page.locator('[title="Tap to edit"]').first();
		await editableField.click();
		const input = page.locator('input[type="text"]').first();
		if (await input.isVisible()) {
			await input.fill('test');
			await input.press('Enter');
		}

		// Toggle view
		await page.getByRole('tab', { name: 'Week' }).click();
		await page.waitForTimeout(500);
		await page.getByRole('tab', { name: 'Day' }).click();

		// Filter out known benign errors
		const realErrors = errors.filter(e =>
			!e.includes('favicon') &&
			!e.includes('chat') &&
			!e.includes('api.heatherandwesley') &&
			!e.includes('ERR_CONNECTION')
		);

		expect(realErrors).toEqual([]);
	});
});
