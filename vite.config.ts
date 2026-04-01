import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

// Rewrite /archive/ to /archive/index.html in dev mode
// (GitHub Pages does this natively in production)
function archiveRewrite(): Plugin {
	return {
		name: 'archive-rewrite',
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (req.url === '/archive/' || req.url === '/archive') {
					req.url = '/archive/index.html';
				}
				next();
			});
		}
	};
}

export default defineConfig({
	plugins: [archiveRewrite(), sveltekit()],
	server: {
		port: 5173,
		strictPort: false,
		allowedHosts: ['wabbazzar-ice.taila666cc.ts.net']
	}
});
