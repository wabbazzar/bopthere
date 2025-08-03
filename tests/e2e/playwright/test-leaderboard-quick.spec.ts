import { test, expect } from '@playwright/test';

test.describe('Quick Leaderboard Navigation Test', () => {
  test('should navigate to leaderboard without errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate to the app
    await page.goto('http://localhost:8080');
    
    // Select a character (Wesley)
    await page.click('text=Choose Wesley');
    await page.waitForTimeout(500);
    
    // Log in (required to see the Festival/Games view)
    await page.click('text=Log in');
    await page.fill('input[placeholder="Enter your username"]', 'test_user');
    await page.fill('input[placeholder="Enter your password"]', 'password123');
    await page.click('button:has-text("Sign in")');
    
    // Wait for navigation to Festival view
    await page.waitForSelector('text=Welcome to the Festival', { timeout: 5000 });
    
    // Navigate to Games tab
    await page.click('text=Games');
    await page.waitForSelector('text=Tournament Leaderboard', { timeout: 5000 });
    
    // Click on the Tournament Leaderboard card
    await page.click('text=Tournament Leaderboard');
    
    // Verify the leaderboard dialog opens without errors
    await page.waitForSelector('text=Tetris Leaderboard', { timeout: 5000 });
    
    // Check that no errors occurred
    expect(errors).toHaveLength(0);
    
    // Verify leaderboard content is visible
    const leaderboardContent = await page.isVisible('text=Top scores');
    expect(leaderboardContent).toBe(true);
    
    console.log('✅ Leaderboard navigation successful!');
  });
});