import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: './tests',
	testMatch: 'chat-e2e.spec.ts',
	timeout: 120000,
	workers: 1,
	use: { headless: true },
	projects: [
		{
			name: 'desktop',
			use: { browserName: 'chromium' }
		},
		{
			name: 'iphone',
			use: {
				browserName: 'chromium',
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true,
				deviceScaleFactor: 3
			}
		}
	]
});
