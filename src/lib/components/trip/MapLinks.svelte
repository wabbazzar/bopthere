<script lang="ts">
	import type { MapLink } from '$lib/types/trip';

	export let mapLinks: MapLink[];

	function googleMapsUrl(from: string, to: string): string {
		const origin = encodeURIComponent(from);
		const destination = encodeURIComponent(to);
		return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
	}
</script>

{#if mapLinks?.length}
	<div class="map-section">
		<p class="map-heading">
			<svg class="map-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
				<line x1="8" y1="2" x2="8" y2="18"/>
				<line x1="16" y1="6" x2="16" y2="22"/>
			</svg>
			Directions
		</p>
		<div class="map-links">
			{#each mapLinks as link}
				<a
					href={googleMapsUrl(link.from, link.to)}
					target="_blank"
					rel="noopener"
					class="map-link"
				>
					<span class="map-link-icon">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="10" r="3"/>
							<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
						</svg>
					</span>
					<span class="map-link-text">
						<span class="map-link-label">{link.label}</span>
						<span class="map-link-route">{link.from} → {link.to}</span>
					</span>
					<span class="map-link-arrow">↗</span>
				</a>
			{/each}
		</div>
	</div>
{/if}

<style>
	.map-section {
		border-top: 1px solid var(--border);
		padding: 0.75rem 1rem;
	}

	.map-heading {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-family: var(--font-display);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-muted);
		margin-bottom: 0.5rem;
	}

	.map-icon {
		color: var(--ink-faint);
		flex-shrink: 0;
	}

	.map-links {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.map-link {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		text-decoration: none;
		color: var(--ink);
		transition: border-color 200ms ease, background-color 150ms ease, box-shadow 200ms ease;
	}

	.map-link:hover {
		border-color: var(--accent);
		background-color: var(--accent-muted);
		box-shadow: 0 1px 4px rgba(184, 110, 43, 0.08);
		color: var(--ink);
	}

	.map-link-icon {
		color: var(--accent);
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.map-link-text {
		flex: 1;
		min-width: 0;
	}

	.map-link-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.map-link-route {
		display: block;
		font-size: 0.65rem;
		color: var(--ink-faint);
		line-height: 1.4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.map-link-arrow {
		font-size: 0.7rem;
		color: var(--ink-faint);
		flex-shrink: 0;
		margin-top: 0.125rem;
		transition: color 150ms ease;
	}

	.map-link:hover .map-link-arrow {
		color: var(--accent);
	}
</style>
