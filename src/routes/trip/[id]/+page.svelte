<script lang="ts">
	import { page } from '$app/stores';
	import { trips } from '$lib/stores/trips';
	import { onMount } from 'svelte';
	import TripHeader from '$lib/components/trip/TripHeader.svelte';
	import ViewToggle from '$lib/components/trip/ViewToggle.svelte';
	import WeekView from '$lib/components/trip/WeekView.svelte';
	import DayView from '$lib/components/trip/DayView.svelte';
	import BookingsSection from '$lib/components/trip/BookingsSection.svelte';
	import TodosSection from '$lib/components/trip/TodosSection.svelte';

	$: tripId = $page.params.id as string;
	$: trip = $trips[tripId];

	let activeView: 'week' | 'day' = 'week';
	let currentDayIndex = 0;

	const DAY_KEY_PREFIX = 'hw-trip-day-';

	onMount(() => {
		trips.init();
		const saved = localStorage.getItem(DAY_KEY_PREFIX + tripId);
		if (saved !== null) {
			const idx = parseInt(saved, 10);
			const maxIdx = (trip?.days?.length ?? 1) - 1;
			if (!isNaN(idx) && idx >= 0) currentDayIndex = Math.min(idx, maxIdx);
		}
	});

	$: if (tripId && typeof localStorage !== 'undefined') {
		localStorage.setItem(DAY_KEY_PREFIX + tripId, String(currentDayIndex));
	}

	function handleSelectDay(e: CustomEvent<number>) {
		currentDayIndex = e.detail;
		activeView = 'day';
	}

	function scrollToSection(id: string) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>{trip?.name || 'Trip'} - H&W Travel</title>
</svelte:head>

{#if trip}
	<TripHeader {trip} {tripId} />

	<div class="view-row">
		<ViewToggle bind:activeView {tripId} />
		<div class="jump-nav" role="group" aria-label="Jump to section">
			{#if trip.bookings?.length}
				<button
					type="button"
					class="jump-link"
					on:click={() => scrollToSection('bookings-section')}
					aria-label="Jump to bookings"
				>
					Bookings
				</button>
				<span class="jump-sep" aria-hidden="true">·</span>
			{/if}
			<button
				type="button"
				class="jump-link"
				on:click={() => scrollToSection('todos-section')}
				aria-label="Jump to todos"
			>
				Todos
			</button>
		</div>
	</div>

	{#if activeView === 'week'}
		<WeekView {trip} {tripId} on:selectDay={handleSelectDay} />
	{:else}
		<DayView {trip} {tripId} bind:currentDayIndex />
	{/if}

	{#if trip.bookings?.length}
		<div id="bookings-section" class="section-wrap mt-8 scroll-mt-4">
			<BookingsSection bookings={trip.bookings} />
			<button
				type="button"
				class="back-to-top"
				on:click={scrollToTop}
				aria-label="Back to top"
				title="Back to top"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path
						d="M6 15l6-6 6 6"
						fill="none"
						stroke="currentColor"
						stroke-width="2.25"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	{/if}

	<div id="todos-section" class="section-wrap mt-6 scroll-mt-4">
		<TodosSection {tripId} />
		<button
			type="button"
			class="back-to-top"
			on:click={scrollToTop}
			aria-label="Back to top"
			title="Back to top"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<path
					d="M6 15l6-6 6 6"
					fill="none"
					stroke="currentColor"
					stroke-width="2.25"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
	</div>
{:else}
	<p>Trip not found.</p>
{/if}

<style>
	.view-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.jump-nav {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
	}
	.jump-link {
		padding: 0.5rem 0.5rem;
		font-family: var(--font-display);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
		background: transparent;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.jump-link:hover {
		color: var(--ink);
		background: var(--accent-muted);
	}
	.jump-sep {
		color: var(--ink-faint);
		font-size: 0.65rem;
		margin: 0 0.125rem;
	}
	.scroll-mt-4 {
		scroll-margin-top: 1rem;
	}

	.section-wrap {
		position: relative;
	}
	.back-to-top {
		position: absolute;
		top: 0;
		right: 0;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink-faint);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease, border-color 150ms ease, transform 150ms ease;
		animation: bob 2.6s ease-in-out infinite;
	}
	.back-to-top:hover {
		color: var(--ink);
		background: var(--accent-muted);
		border-color: var(--accent);
		animation-play-state: paused;
	}
	.back-to-top:active {
		transform: translateY(0) scale(0.96);
	}
	@keyframes bob {
		0%, 100% { transform: translateY(0); }
		50%      { transform: translateY(-3px); }
	}
	@media (prefers-reduced-motion: reduce) {
		.back-to-top { animation: none; }
	}
</style>
