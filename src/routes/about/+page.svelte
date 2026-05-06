<script lang="ts">
	import { isAuthenticated } from '$lib/stores/auth';
</script>

<svelte:head>
	<title>About - BopThere</title>
</svelte:head>

<div class="about-page">
	<header class="about-header">
		<a href="/" class="logo font-display">BopThere</a>
		<nav>
			{#if $isAuthenticated}
				<a href="/dashboard" class="nav-link">Trips</a>
			{:else}
				<a href="/" class="nav-link">Sign in</a>
			{/if}
		</nav>
	</header>

	<main class="about-main">
		<section class="hero">
			<img src="/favicon.png" alt="BopThere mascot" class="hero-mascot" />
			<h1 class="font-display hero-title">BopThere</h1>
			<p class="hero-tagline">Plan trips. Find deals. Bop there.</p>
			<p class="hero-lede">
				A travel planning app with an AI companion, daily flight deals,
				and everything you need to go from idea to itinerary
				 — day-by-day planning, bookings, journals, and real-time alerts
				when prices drop on routes you care about.
			</p>
		</section>

		<section class="features">
			<div class="feature-grid">
				<div class="feature-card highlight">
					<div class="feature-icon">&#128184;</div>
					<h3>Daily Deal Alerts</h3>
					<p>
						Set your home airport and dream destinations. BopThere scans for flight deals
						daily and sends alerts via Signal when prices drop on routes you care about.
					</p>
				</div>

				<div class="feature-card">
					<div class="feature-icon">&#9992;</div>
					<h3>Trip Planning</h3>
					<p>
						Day-by-day itineraries with morning, afternoon, and evening slots.
						Week and day views. Locations, notes, and accommodation details.
					</p>
				</div>

				<div class="feature-card">
					<div class="feature-icon">&#128172;</div>
					<h3>AI Travel Companion</h3>
					<p>
						Chat with Claude about your trip. Get activity suggestions, restaurant picks,
						and logistics advice that understands your itinerary.
					</p>
				</div>

				<div class="feature-card">
					<div class="feature-icon">&#128203;</div>
					<h3>Bookings & Tickets</h3>
					<p>
						Flights, hotels, and car rentals in one place. Attach PDF tickets
						 — tap to open, no digging through email.
					</p>
				</div>

				<div class="feature-card">
					<div class="feature-icon">&#128221;</div>
					<h3>Journal & Photos</h3>
					<p>
						Capture daily memories with text entries and photo uploads.
						Entries sync in real-time between devices.
					</p>
				</div>

				<div class="feature-card">
					<div class="feature-icon">&#9745;</div>
					<h3>Shared Todos</h3>
					<p>
						Per-trip task lists for packing, reservations, and errands.
						Travel partners see the same list, synced through the server.
					</p>
				</div>
			</div>
		</section>

		<section class="tech">
			<h2 class="font-display section-title">How it works</h2>
			<div class="tech-pills">
				<span class="pill">SvelteKit</span>
				<span class="pill">TypeScript</span>
				<span class="pill">FastAPI</span>
				<span class="pill">SQLite</span>
				<span class="pill">Claude AI</span>
				<span class="pill">GitHub Pages</span>
			</div>
			<p class="tech-desc">
				Static frontend deployed to GitHub Pages. FastAPI backend on a home server
				with SQLite persistence. Real-time sync between devices via IndexedDB + server pull.
				No cloud dependencies beyond hosting.
			</p>
		</section>

		<section class="cta">
			{#if $isAuthenticated}
				<a href="/dashboard" class="btn-primary cta-btn">Go to Trips</a>
			{:else}
				<a href="/" class="btn-primary cta-btn">Sign in</a>
			{/if}
		</section>
	</main>

	<footer class="about-footer">
		<p>BopThere &middot; Austin, TX</p>
	</footer>
</div>

<style>
	.about-page {
		min-height: 100dvh;
		background: var(--surface);
		display: flex;
		flex-direction: column;
	}

	.about-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-alt);
	}

	.logo {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--ink);
		text-decoration: none;
	}

	.nav-link {
		font-family: var(--font-body);
		font-size: 0.875rem;
		color: var(--ink-muted);
		text-decoration: none;
		padding: 0.4rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition: border-color 150ms ease, color 150ms ease;
	}

	.nav-link:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.about-main {
		flex: 1;
		max-width: 48rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		width: 100%;
	}

	.hero {
		text-align: center;
		padding: 2rem 0 3rem;
	}

	.hero-mascot {
		width: 120px;
		height: 120px;
		border-radius: 1.5rem;
		margin-bottom: 1rem;
	}

	.hero-title {
		font-size: 2.5rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: var(--ink);
		margin: 0 0 0.5rem;
	}

	.hero-tagline {
		font-family: var(--font-body);
		font-size: 1.125rem;
		font-style: italic;
		color: var(--accent);
		margin: 0 0 1rem;
	}

	.hero-lede {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--ink-muted);
		line-height: 1.6;
		max-width: 32rem;
		margin: 0 auto;
	}

	.features {
		padding: 2rem 0;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1.25rem;
	}

	.feature-card {
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1.5rem;
	}

	.feature-icon {
		font-size: 1.75rem;
		margin-bottom: 0.5rem;
	}

	.feature-card.highlight {
		border-color: var(--accent);
		background: linear-gradient(135deg, var(--surface-raised), var(--surface-alt));
	}

	.feature-card h3 {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 0.5rem;
	}

	.feature-card p {
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--ink-muted);
		line-height: 1.5;
		margin: 0;
	}

	.tech {
		text-align: center;
		padding: 2rem 0;
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 1rem;
	}

	.tech-pills {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.pill {
		font-family: var(--font-body);
		font-size: 0.75rem;
		letter-spacing: 0.03em;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		background: var(--accent-muted);
		color: var(--accent);
	}

	.tech-desc {
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--ink-muted);
		line-height: 1.6;
		max-width: 30rem;
		margin: 0 auto;
	}

	.cta {
		text-align: center;
		padding: 2rem 0;
	}

	.cta-btn {
		display: inline-block;
		text-decoration: none;
		padding: 0.75rem 2rem;
		font-size: 1rem;
	}

	.about-footer {
		text-align: center;
		padding: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.about-footer p {
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--ink-faint);
		margin: 0;
	}
</style>
