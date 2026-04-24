<script lang="ts">
	import type { Booking } from '$lib/types/trip';
	import { signTicketUrl } from '$lib/services/bookings';

	export let bookings: Booking[];
	export let tripId: string;

	let expandedIndex: number | null = null;
	let showPast = false;

	function toggle(i: number) {
		expandedIndex = expandedIndex === i ? null : i;
	}

	function formatDate(d: string) {
		const date = new Date(d + 'T12:00:00');
		return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function isUpcoming(booking: Booking): boolean {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const bookingDate = new Date(booking.date + 'T12:00:00');
		bookingDate.setHours(0, 0, 0, 0);
		return bookingDate >= today;
	}

	function byDate(a: Booking, b: Booking): number {
		return a.date.localeCompare(b.date);
	}

	$: upcomingBookings = bookings.filter(isUpcoming).sort(byDate);
	$: pastBookings = bookings.filter(b => !isUpcoming(b)).sort(byDate);

	/**
	 * Open a ticket PDF via a short-lived signed URL.
	 *
	 * We open a blank tab synchronously from the click handler so popup
	 * blockers don't flag it, then redirect it once the sign call resolves.
	 */
	async function openTicket(name: string, e: MouseEvent) {
		e.preventDefault();
		const newWin = window.open('about:blank', '_blank');
		try {
			const url = await signTicketUrl(tripId, name);
			if (newWin) newWin.location.href = url;
			else window.location.href = url;
		} catch (err) {
			if (newWin) newWin.close();
			console.error('Failed to open ticket', err);
		}
	}
</script>

<div class="card p-5">
	<p class="section-label mb-3">Bookings</p>

	<ul class="space-y-2">
		{#each upcomingBookings as booking}
			{@const i = bookings.indexOf(booking)}
			<li class="booking" class:booking--expanded={expandedIndex === i}>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="booking-header" on:click={() => toggle(i)}>
					<span class="booking-type" class:booking-type--flight={booking.type === 'flight'}>
						{#if booking.type === 'flight'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.7 5.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
						{:else if booking.type === 'train'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></svg>
						{:else if booking.type === 'hotel'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M9 16h.01"/><path d="M15 16h.01"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9 22v-6h6v6"/></svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
						{/if}
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
						<div class="booking-links">
							{#if booking.ticketUrl}
								{@const names = Array.isArray(booking.ticketUrl) ? booking.ticketUrl : [booking.ticketUrl]}
								{#each names as name, j}
									<a
										href="#"
										on:click={(e) => openTicket(name, e)}
										class="booking-ticket"
									>
										{names.length > 1 ? `Ticket ${j + 1} ↗` : 'View ticket ↗'}
									</a>
								{/each}
							{/if}
							{#if booking.bookingUrl}
								<a href={booking.bookingUrl} target="_blank" rel="noopener" class="booking-ticket booking-link">
									Booking page ↗
								</a>
							{/if}
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if pastBookings.length > 0}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="past-toggle"
			on:click={() => showPast = !showPast}
			role="button"
			tabindex="0"
			aria-expanded={showPast}
			aria-label="Toggle past bookings"
		>
			<span class="past-chevron" class:past-chevron--open={showPast}>›</span>
			<span class="past-label">Past bookings ({pastBookings.length})</span>
		</div>

		{#if showPast}
			<ul class="space-y-2 mt-2">
				{#each pastBookings as booking}
					{@const i = bookings.indexOf(booking)}
					<li class="booking booking--past" class:booking--expanded={expandedIndex === i}>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="booking-header" on:click={() => toggle(i)}>
							<span class="booking-type" class:booking-type--flight={booking.type === 'flight'}>
								{#if booking.type === 'flight'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.7 5.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
								{:else if booking.type === 'train'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></svg>
								{:else if booking.type === 'hotel'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M9 16h.01"/><path d="M15 16h.01"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9 22v-6h6v6"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="booking-icon"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
								{/if}
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
								<div class="booking-links">
									{#if booking.ticketUrl}
										{@const names = Array.isArray(booking.ticketUrl) ? booking.ticketUrl : [booking.ticketUrl]}
										{#each names as name, j}
											<a
												href="#"
												on:click={(e) => openTicket(name, e)}
												class="booking-ticket"
											>
												{names.length > 1 ? `Ticket ${j + 1} ↗` : 'View ticket ↗'}
											</a>
										{/each}
									{/if}
									{#if booking.bookingUrl}
										<a href={booking.bookingUrl} target="_blank" rel="noopener" class="booking-ticket booking-link">
											Booking page ↗
										</a>
									{/if}
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
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
		width: 1.5rem;
		text-align: center;
		flex-shrink: 0;
		color: var(--ink-muted);
	}

	.booking-type :global(.booking-icon) {
		width: 1rem;
		height: 1rem;
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

	.booking-links {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.booking-link {
		color: var(--ink-muted);
	}

	.booking-link:hover {
		color: var(--accent);
	}

	.past-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		margin-top: 0.75rem;
		cursor: pointer;
		border-radius: var(--radius);
		transition: background-color 150ms ease;
	}

	.past-toggle:hover {
		background-color: var(--accent-muted);
	}

	.past-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.past-chevron {
		font-size: 0.7rem;
		color: var(--ink-faint);
		transition: transform 200ms ease;
		display: inline-block;
	}

	.past-chevron--open {
		transform: rotate(90deg);
	}

	.booking--past {
		opacity: 0.55;
	}

	.booking--past:hover {
		opacity: 0.85;
	}
</style>
