<script lang="ts">
	import { trips, featuredTrip } from '$lib/data/trips';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let showContent = $state(false);
	let mouseX = $state(0.5);
	let mouseY = $state(0.5);
	let selectedYear = $state<number | null>(null);

	onMount(() => {
		mounted = true;
		setTimeout(() => showContent = true, 800);

		const handleMouse = (e: MouseEvent) => {
			mouseX = e.clientX / window.innerWidth;
			mouseY = e.clientY / window.innerHeight;
		};
		window.addEventListener('mousemove', handleMouse);
		return () => window.removeEventListener('mousemove', handleMouse);
	});

	function selectTrip(year: number) {
		selectedYear = year;
	}

	function closeModal() {
		selectedYear = null;
	}

	$effect(() => {
		if (selectedYear) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	});

	const parallaxX = $derived((mouseX - 0.5) * 30);
	const parallaxY = $derived((mouseY - 0.5) * 30);
</script>

<svelte:head>
	<title>H & W Travels | Birthday Adventures</title>
</svelte:head>

<div class="noise"></div>
<div class="vignette"></div>

<!-- Hero Section -->
<section class="hero">
	<div class="hero-bg" style="transform: translate({parallaxX}px, {parallaxY}px) scale(1.1)">
		<div class="hero-gradient"></div>
	</div>

	<div class="particles">
		{#each Array(20) as _, i}
			<div class="particle" style="--delay: {i * 0.3}s; --duration: {4 + Math.random() * 3}s; --x: {Math.random() * 100}%; --drift: {(Math.random() - 0.5) * 100}px;"></div>
		{/each}
	</div>

	<div class="hero-content" class:visible={mounted}>
		<div class="sparkle">✦</div>
		<h1 class="title font-display">
			<span class="title-main">H & W</span>
			<span class="title-sub">TRAVELS</span>
		</h1>
		<p class="tagline">Birthday Adventures Since 2022</p>

		<div class="year-badges" class:visible={showContent}>
			{#each trips as trip, i}
				<button
					class="year-badge"
					class:featured={trip.isFeatured}
					style="--color: {trip.color}; --delay: {0.3 + i * 0.1}s;"
					onclick={() => selectTrip(trip.year)}
				>
					{trip.year}
				</button>
			{/each}
		</div>

		{#if showContent}
			<div class="scroll-indicator">
				<span>Explore</span>
				<div class="scroll-arrow">↓</div>
			</div>
		{/if}
	</div>
</section>

<!-- Featured Section -->
<section class="featured" class:visible={showContent}>
	<div class="featured-header">
		<span class="featured-label font-display">FEATURED ADVENTURE</span>
		<h2 class="featured-title font-display">{featuredTrip.destination}</h2>
		<p class="featured-location">{featuredTrip.location}</p>
	</div>

	<div class="featured-content">
		<div class="featured-card">
			<div class="card-glow"></div>
			<div class="card-inner">
				<div class="card-year font-display">{featuredTrip.year}</div>
				<p class="card-tagline">"{featuredTrip.tagline}"</p>
				<p class="card-description">{featuredTrip.description}</p>

				<div class="card-stats">
					<div class="stat">
						<span class="stat-value">{featuredTrip.crew}+</span>
						<span class="stat-label">Adventurers</span>
					</div>
					<div class="stat">
						<span class="stat-value">{featuredTrip.highlights.length}</span>
						<span class="stat-label">Highlights</span>
					</div>
					<div class="stat">
						<span class="stat-value">∞</span>
						<span class="stat-label">Memories</span>
					</div>
				</div>

				<div class="highlights">
					{#each featuredTrip.highlights as highlight}
						<span class="highlight-tag">{highlight}</span>
					{/each}
				</div>

				<button class="cta-button font-display" onclick={() => selectTrip(featuredTrip.year)}>
					View Details →
				</button>
			</div>
		</div>
	</div>
</section>

<!-- Timeline Section -->
<section class="timeline" class:visible={showContent}>
	<h2 class="timeline-title font-display">The Journey So Far</h2>
	<div class="timeline-grid">
		{#each trips as trip, i}
			<button
				class="timeline-card"
				class:featured={trip.isFeatured}
				style="--delay: {i * 0.1}s; --color: {trip.color}"
				onclick={() => selectTrip(trip.year)}
			>
				<div class="timeline-card-glow"></div>
				<div class="timeline-card-inner">
					<span class="timeline-year font-display">{trip.year}</span>
					<h3 class="timeline-destination font-display">{trip.destination}</h3>
					<p class="timeline-location">{trip.location}</p>
					<p class="timeline-tagline">"{trip.tagline}"</p>
					<div class="timeline-crew">
						{#each Array(Math.min(trip.crew, 6)) as _}
							<span class="crew-dot"></span>
						{/each}
						{#if trip.crew > 6}
							<span class="crew-more">+{trip.crew - 6}</span>
						{/if}
					</div>
					<span class="timeline-enter">Enter Portal →</span>
				</div>
			</button>
		{/each}
	</div>
</section>

<footer class="footer">
	<p>H & W Birthday Chronicles • 2022 - Present</p>
	<p class="footer-sub">Every year, a new adventure</p>
</footer>

<!-- Modal -->
{#if selectedYear}
	{@const trip = trips.find(t => t.year === selectedYear)}
	{#if trip}
		<div class="modal-overlay" onclick={closeModal}>
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header" style="background: linear-gradient(135deg, {trip.color}dd, {trip.color}88)">
					<button class="modal-close" onclick={closeModal}>×</button>
					<span class="modal-chapter font-display">CHAPTER</span>
					<h2 class="modal-year font-display">{trip.year}</h2>
					<p class="modal-destination">{trip.destination}</p>
				</div>
				<div class="modal-body">
					<div class="modal-stats">
						<div class="modal-stat">📍 {trip.location}</div>
						<div class="modal-stat">👥 {trip.crew} Adventurers</div>
						<div class="modal-stat">📅 {trip.dates}</div>
					</div>
					<p class="modal-description">{trip.description}</p>
					<h3 class="modal-highlights-title font-display">Highlights</h3>
					<div class="modal-highlights">
						{#each trip.highlights as highlight}
							<span class="modal-highlight">{highlight}</span>
						{/each}
					</div>
					<div class="modal-gallery">
						{#each Array(6) as _, i}
							<div class="gallery-placeholder">Photo {i + 1}</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.noise {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 100;
		opacity: 0.03;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
	}

	.vignette {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 50;
		background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%);
	}

	.hero {
		position: relative;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.hero-bg {
		position: absolute;
		inset: -50px;
		background: linear-gradient(135deg, #0c4a6e 0%, #1e3a5f 30%, #1a365d 60%, #0f172a 100%);
		transition: transform 0.1s ease-out;
	}

	.hero-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.8) 100%);
	}

	.particles {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.particle {
		position: absolute;
		bottom: 20%;
		left: var(--x);
		width: 4px;
		height: 4px;
		background: radial-gradient(circle, rgba(255,215,0,0.8) 0%, transparent 70%);
		border-radius: 50%;
		animation: float var(--duration) var(--delay) infinite ease-out;
	}

	@keyframes float {
		0% { transform: translateY(0) translateX(0); opacity: 0; }
		20% { opacity: 1; }
		100% { transform: translateY(-400px) translateX(var(--drift)); opacity: 0; }
	}

	.hero-content {
		position: relative;
		z-index: 10;
		text-align: center;
		padding: 2rem;
		opacity: 0;
		transform: translateY(30px);
		transition: all 1s ease-out;
	}

	.hero-content.visible {
		opacity: 1;
		transform: translateY(0);
	}

	.sparkle {
		font-size: 2rem;
		color: #fbbf24;
		margin-bottom: 1rem;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.5; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	.title {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.title-main {
		font-size: clamp(4rem, 15vw, 10rem);
		font-weight: 700;
		background: linear-gradient(180deg, #fcd34d 0%, #f59e0b 50%, #b45309 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		filter: drop-shadow(0 4px 20px rgba(0,0,0,0.5));
	}

	.title-sub {
		font-size: clamp(1.5rem, 4vw, 3rem);
		letter-spacing: 0.5em;
		color: #fde68a;
	}

	.tagline {
		margin-top: 1.5rem;
		font-size: 1.25rem;
		color: rgba(253, 230, 138, 0.7);
		font-style: italic;
	}

	.year-badges {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 2rem;
		opacity: 0;
		transform: translateY(20px);
		transition: all 0.8s ease-out 0.5s;
	}

	.year-badges.visible {
		opacity: 1;
		transform: translateY(0);
	}

	.year-badge {
		padding: 0.5rem 1.25rem;
		border-radius: 9999px;
		border: none;
		background: var(--color);
		color: white;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.3s ease;
		animation: fadeInUp 0.5s var(--delay) both;
	}

	.year-badge:hover {
		transform: scale(1.1);
		box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
	}

	.year-badge.featured {
		padding: 0.5rem 1.5rem;
		font-size: 1rem;
		box-shadow: 0 0 20px var(--color);
	}

	@keyframes fadeInUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.scroll-indicator {
		position: absolute;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		color: rgba(253, 230, 138, 0.7);
		font-size: 0.875rem;
		animation: fadeIn 1s 1s both;
	}

	.scroll-arrow {
		animation: bounce 1.5s infinite;
	}

	@keyframes bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(10px); }
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.featured {
		position: relative;
		padding: 6rem 2rem;
		background: linear-gradient(to bottom, #0a0a0a, #111827);
		opacity: 0;
		transform: translateY(50px);
		transition: all 1s ease-out;
	}

	.featured.visible {
		opacity: 1;
		transform: translateY(0);
	}

	.featured-header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.featured-label {
		display: inline-block;
		padding: 0.25rem 1rem;
		background: linear-gradient(135deg, #0284c7, #6366f1);
		border-radius: 9999px;
		font-size: 0.75rem;
		letter-spacing: 0.2em;
		margin-bottom: 1rem;
	}

	.featured-title {
		font-size: clamp(3rem, 8vw, 6rem);
		background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.featured-location {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.6);
		margin-top: 0.5rem;
	}

	.featured-content {
		max-width: 800px;
		margin: 0 auto;
	}

	.featured-card {
		position: relative;
	}

	.card-glow {
		position: absolute;
		inset: -2px;
		background: linear-gradient(135deg, #0284c7, #6366f1, #0284c7);
		border-radius: 1.5rem;
		filter: blur(20px);
		opacity: 0.3;
	}

	.card-inner {
		position: relative;
		padding: 3rem;
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9));
		border-radius: 1.5rem;
		border: 1px solid rgba(56, 189, 248, 0.2);
	}

	.card-year {
		font-size: 4rem;
		background: linear-gradient(180deg, #38bdf8, #0284c7);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.card-tagline {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.8);
		font-style: italic;
		margin: 1rem 0;
	}

	.card-description {
		color: rgba(255, 255, 255, 0.6);
		line-height: 1.8;
		font-size: 1.125rem;
	}

	.card-stats {
		display: flex;
		gap: 2rem;
		margin: 2rem 0;
		padding: 1.5rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: #38bdf8;
	}

	.stat-label {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.highlights {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.5rem 0;
	}

	.highlight-tag {
		padding: 0.375rem 0.75rem;
		background: rgba(56, 189, 248, 0.1);
		border: 1px solid rgba(56, 189, 248, 0.3);
		border-radius: 9999px;
		font-size: 0.875rem;
		color: #7dd3fc;
	}

	.cta-button {
		margin-top: 1rem;
		padding: 1rem 2rem;
		background: linear-gradient(135deg, #0284c7, #6366f1);
		border: none;
		border-radius: 0.75rem;
		color: white;
		font-size: 1rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.cta-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 40px rgba(2, 132, 199, 0.4);
	}

	.timeline {
		padding: 6rem 2rem;
		background: #0a0a0a;
		opacity: 0;
		transition: all 1s ease-out;
	}

	.timeline.visible {
		opacity: 1;
	}

	.timeline-title {
		text-align: center;
		font-size: clamp(2rem, 5vw, 3rem);
		color: #fde68a;
		margin-bottom: 3rem;
	}

	.timeline-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.timeline-card {
		position: relative;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		animation: fadeInUp 0.5s var(--delay) both;
	}

	.timeline-card-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at center, var(--color) 0%, transparent 70%);
		opacity: 0;
		filter: blur(30px);
		transition: opacity 0.3s ease;
	}

	.timeline-card:hover .timeline-card-glow {
		opacity: 0.4;
	}

	.timeline-card-inner {
		position: relative;
		padding: 2rem;
		background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(30, 30, 30, 0.9));
		border-radius: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
	}

	.timeline-card:hover .timeline-card-inner {
		transform: translateY(-5px);
		border-color: var(--color);
	}

	.timeline-year {
		font-size: 3rem;
		font-weight: 700;
		color: var(--color);
	}

	.timeline-destination {
		font-size: 1.5rem;
		color: white;
		margin: 0.5rem 0;
	}

	.timeline-location {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.timeline-tagline {
		font-size: 1rem;
		color: rgba(255, 255, 255, 0.7);
		font-style: italic;
		margin: 1rem 0;
	}

	.timeline-crew {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin: 1rem 0;
	}

	.crew-dot {
		width: 8px;
		height: 8px;
		background: var(--color);
		border-radius: 50%;
		opacity: 0.7;
	}

	.crew-more {
		margin-left: 0.25rem;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.timeline-enter {
		display: inline-block;
		font-size: 0.875rem;
		color: var(--color);
		opacity: 0;
		transform: translateX(-10px);
		transition: all 0.3s ease;
	}

	.timeline-card:hover .timeline-enter {
		opacity: 1;
		transform: translateX(0);
	}

	.footer {
		padding: 3rem 2rem;
		text-align: center;
		background: #050505;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.875rem;
	}

	.footer-sub {
		color: rgba(255, 255, 255, 0.3);
		font-size: 0.75rem;
		margin-top: 0.5rem;
		font-style: italic;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(10px);
		animation: fadeIn 0.3s ease;
	}

	.modal {
		position: relative;
		max-width: 700px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		background: linear-gradient(180deg, #1a1a1a, #0a0a0a);
		border-radius: 1.5rem;
		animation: modalIn 0.4s ease;
	}

	@keyframes modalIn {
		from { opacity: 0; transform: scale(0.9) translateY(20px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.modal-header {
		position: relative;
		padding: 3rem 2rem;
		text-align: center;
	}

	.modal-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		width: 2.5rem;
		height: 2.5rem;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.modal-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.modal-chapter {
		font-size: 0.75rem;
		letter-spacing: 0.3em;
		color: rgba(255, 255, 255, 0.7);
	}

	.modal-year {
		font-size: 5rem;
		color: white;
	}

	.modal-destination {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.9);
		margin-top: 0.5rem;
	}

	.modal-body {
		padding: 2rem;
	}

	.modal-stats {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.modal-stat {
		color: rgba(255, 255, 255, 0.7);
	}

	.modal-description {
		color: rgba(255, 255, 255, 0.7);
		line-height: 1.8;
		font-size: 1.125rem;
	}

	.modal-highlights-title {
		font-size: 1.25rem;
		color: white;
		margin: 2rem 0 1rem;
	}

	.modal-highlights {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.modal-highlight {
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 9999px;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.8);
	}

	.modal-gallery {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		margin-top: 2rem;
	}

	.gallery-placeholder {
		aspect-ratio: 1;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.3);
		font-size: 0.75rem;
	}

	@media (max-width: 640px) {
		.card-stats { flex-direction: column; gap: 1rem; }
		.modal-gallery { grid-template-columns: repeat(2, 1fr); }
	}
</style>
