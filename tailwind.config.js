/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				surface: {
					DEFAULT: 'var(--surface)',
					alt: 'var(--surface-alt)',
					raised: 'var(--surface-raised)'
				},
				ink: {
					DEFAULT: 'var(--ink)',
					muted: 'var(--ink-muted)',
					faint: 'var(--ink-faint)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					hover: 'var(--accent-hover)',
					muted: 'var(--accent-muted)'
				},
				border: {
					DEFAULT: 'var(--border)',
					strong: 'var(--border-strong)'
				},
				danger: 'var(--danger)',
				success: 'var(--success)',
				warn: 'var(--warn)'
			},
			fontFamily: {
				display: 'var(--font-display)',
				body: 'var(--font-body)'
			},
			borderRadius: {
				skin: 'var(--radius)'
			}
		}
	},
	plugins: []
};
