import { test, expect } from '@playwright/test';

test('navigation should be hidden until character is selected', async ({ page }) => {
  // Go to the app
  await page.goto('http://localhost:8085');
  
  // Check that navigation is not visible initially
  const navVisible = await page.locator('.fixed.top-4').isVisible();
  console.log('Navigation visible before character selection:', navVisible);
  
  // Take screenshot
  await page.screenshot({ path: 'tmp/nav-before-character.png' });
  
  // Expect navigation to be hidden
  expect(navVisible).toBe(false);
});