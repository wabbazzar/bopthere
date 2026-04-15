import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['tests/unit/setup.ts']
	},
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, 'src/lib'),
			'$env/static/public': path.resolve(__dirname, 'tests/unit/mocks/env.ts'),
			'$app/navigation': path.resolve(__dirname, 'tests/unit/mocks/app-navigation.ts')
		}
	}
});
