<script lang="ts">
	import type { Booking } from '$lib/types/trip';

	export let bookings: Booking[];

	let expandedIndex: number | null = null;

	function toggle(i: number) {
		expandedIndex = expandedIndex === i ? null : i;
	}

	function formatDate(d: string) {
		const date = new Date(d + 'T12:00:00');
		return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}
</script>

<div class="card p-5">
	<p class="section-label mb-3">Bookings</p>

	<ul class="space-y-2">
		{#each bookings as booking, i}
			<li class="booking" class:booking--expanded={expandedIndex === i}>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="booking-header" on:click={() => toggle(i)}>
					<span class="booking-type" class:booking-type--flight={booking.type === 'flight'}>
						{booking.type === 'flight' ? '✈' : '🏨'}
					</span>
					<div class="booking-info">
						<span class="booking-label">{booking.label}</span>
						<span class="booking-date">{formatDate(booking.date)}</span>
					</div>
					{#if booking.confirmation}
						<span class="booking-conf">{booking.confirmation}</span>
					{/if}
					<span class="booking-chevron">{expandedIndex === i ? '▾' : '›'}</span>
				</div>

				{#if expandedIndex === i}
					<div class="booking-details">
						{#each booking.details as detail}
							<p class="booking-detail">{detail}</p>
						{/each}
						{#if booking.ticketUrl}
							<a href={booking.ticketUrl} target="_blank" rel="noopener" class="booking-ticket">
								View ticket ↗
							</a>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.booking {
		border-radius: var(--radius);
		border: 1px solid var(--border);
		transition: border-color 200ms ease;
		overflow: hidden;
	}

	.booking:hover {
		border-color: var(--border-strong);
	}

	.booking--expanded {
		border-color: var(--accent);
	}

	.booking-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem 0.75rem;
		cursor: pointer;
		transition: background-color 150ms ease;
	}

	.booking-header:hover {
		background-color: var(--accent-muted);
	}

	.booking-type {
		font-size: 0.85rem;
		width: 1.5rem;
		text-align: center;
		flex-shrink: 0;
	}

	.booking-info {
		flex: 1;
		min-width: 0;
	}

	.booking-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1.3;
	}

	.booking-date {
		font-size: 0.7rem;
		color: var(--ink-faint);
	}

	.booking-conf {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
		background: var(--surface-alt);
		padding: 0.15rem 0.4rem;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.booking-chevron {
		font-size: 0.65rem;
		color: var(--ink-faint);
		flex-shrink: 0;
		transition: transform 200ms ease;
	}

	.booking-details {
		padding: 0 0.75rem 0.625rem 2.875rem;
	}

	.booking-detail {
		font-size: 0.78rem;
		color: var(--ink-muted);
		line-height: 1.6;
	}

	.booking-ticket {
		display: inline-block;
		margin-top: 0.4rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--accent);
		transition: color 150ms ease;
	}

	.booking-ticket:hover {
		color: var(--accent-hover);
	}
</style>
