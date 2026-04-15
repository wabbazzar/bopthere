<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { trips } from '$lib/stores/trips';
	import { tripFromCreate, slugifyTripId, distributeDestinations } from '$lib/services/chat-actions';
	import DateRangePicker from '$lib/components/ui/DateRangePicker.svelte';

	export let open = false;

	const dispatch = createEventDispatcher<{ created: { id: string }; close: void }>();

	let name = '';
	let startDate = '';
	let endDate = '';
	let destinationsInput = '';
	let destinations: string[] = [];
	let error = '';
	let nameInput: HTMLInputElement | undefined;

	$: if (open) {
		tick().then(() => nameInput?.focus());
	}

	function reset() {
		name = '';
		startDate = '';
		endDate = '';
		destinationsInput = '';
		destinations = [];
		error = '';
	}

	function close() {
		reset();
		dispatch('close');
	}

	function handleBackdropClick(e: MouseEvent) {
		// Only close on actual backdrop click, not modal content click
		if (e.target === e.currentTarget) close();
	}

	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}

	function addDestinationFromInput() {
		const raw = destinationsInput.trim();
		if (!raw) return;
		const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
		for (const p of parts) {
			if (!destinations.includes(p)) destinations = [...destinations, p];
		}
		destinationsInput = '';
	}

	function removeDestination(d: string) {
		destinations = destinations.filter((x) => x !== d);
	}

	function destinationsKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addDestinationFromInput();
		} else if (e.key === 'Backspace' && !destinationsInput && destinations.length > 0) {
			destinations = destinations.slice(0, -1);
		}
	}

	$: canSubmit = name.trim().length > 0 && Boolean(startDate) && Boolean(endDate);

	function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		if (!canSubmit) {
			error = 'Please enter a name and pick both dates.';
			return;
		}
		// Capture any pending destination typed but not yet committed
		if (destinationsInput.trim()) addDestinationFromInput();

		const existing = new Set(Object.keys(get(trips)));
		const id = slugifyTripId(name.trim(), startDate, existing);
		const trip = tripFromCreate({
			id,
			name: name.trim(),
			startDate,
			endDate,
			destinations
		});

		// Auto-distribute destinations across days: e.g. 3 destinations over
		// 21 days gives 7 days each. The user can still edit any day's
		// location individually afterward.
		if (destinations.length > 0) {
			const locations = distributeDestinations(trip.days.length, destinations);
			for (let i = 0; i < trip.days.length; i++) {
				trip.days[i].location = locations[i] ?? '';
			}
		}

		if (!trips.addTrip(trip)) {
			error = 'A trip with that name/date already exists.';
			return;
		}

		dispatch('created', { id });
		reset();
	}
</script>

<svelte:window on:keydown={handleEscape} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="backdrop" on:click={handleBackdropClick} role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="new-trip-title">
			<header class="modal-header">
				<h2 class="modal-title" id="new-trip-title">New trip</h2>
				<button
					type="button"
					class="close-btn"
					aria-label="Close new trip dialog"
					on:click={close}
				>
					&times;
				</button>
			</header>

			<form class="modal-body" on:submit={handleSubmit}>
				<label class="field">
					<span class="field-label">Name<span class="req" aria-hidden="true">*</span></span>
					<input
						bind:this={nameInput}
						bind:value={name}
						type="text"
						placeholder="e.g. Europe Summer 2026"
						autocomplete="off"
						aria-required="true"
					/>
				</label>

				<div class="field">
					<span class="field-label">Dates<span class="req" aria-hidden="true">*</span></span>
					<DateRangePicker
						bind:startDate
						bind:endDate
					/>
				</div>

				<details class="optional">
					<summary>Add destinations <span class="optional-hint">(optional)</span></summary>
					<div class="tag-input-wrap">
						<div class="tags">
							{#each destinations as d}
								<span class="tag">
									{d}
									<button
										type="button"
										class="tag-remove"
										aria-label="Remove {d}"
										on:click={() => removeDestination(d)}
									>
										&times;
									</button>
								</span>
							{/each}
							<input
								type="text"
								bind:value={destinationsInput}
								on:keydown={destinationsKeydown}
								on:blur={addDestinationFromInput}
								placeholder={destinations.length ? '' : 'Barcelona, Cannes, Lisbon'}
								class="tag-input"
								aria-label="Add destination"
							/>
						</div>
						<div class="hint">Press Enter or comma to add · Backspace to remove</div>
					</div>
				</details>

				{#if error}
					<div class="error" role="alert">{error}</div>
				{/if}

				<footer class="modal-footer">
					<button type="button" class="btn btn-ghost" on:click={close}>Cancel</button>
					<button type="submit" class="btn btn-primary" disabled={!canSubmit}>
						Create trip
					</button>
				</footer>

				<p class="small-print">
					You can fill in hotels, activities, and other details after creating the trip.
				</p>
			</form>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(61, 43, 31, 0.35);
		backdrop-filter: blur(2px);
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fade-in 160ms ease;
	}

	.modal {
		background: var(--surface);
		border-radius: calc(var(--radius) * 1.5);
		box-shadow: 0 20px 50px rgba(61, 43, 31, 0.25);
		width: 100%;
		max-width: 420px;
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		animation: pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
		border: 1px solid var(--border);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem 0.5rem;
	}

	.modal-title {
		font-family: var(--font-display, inherit);
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		color: var(--ink);
	}

	.close-btn {
		border: none;
		background: transparent;
		color: var(--ink-muted);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius);
	}

	.close-btn:hover {
		background: var(--accent-muted);
		color: var(--ink);
	}

	.modal-body {
		padding: 0.5rem 1.25rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
		font-weight: 600;
	}

	.req {
		color: var(--accent);
		margin-left: 0.2rem;
	}

	input[type='text'] {
		width: 100%;
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--surface-raised);
		color: var(--ink);
		font-family: inherit;
		font-size: 0.95rem;
		transition: border-color 120ms ease, box-shadow 120ms ease;
	}

	input[type='text']:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-muted);
	}

	.optional {
		border-top: 1px dashed var(--border);
		padding-top: 0.75rem;
	}

	.optional > summary {
		cursor: pointer;
		list-style: none;
		font-size: 0.8rem;
		color: var(--ink-muted);
		user-select: none;
		padding: 0.1rem 0;
	}

	.optional > summary::-webkit-details-marker {
		display: none;
	}

	.optional > summary::before {
		content: '▸';
		display: inline-block;
		margin-right: 0.35rem;
		transition: transform 160ms ease;
		color: var(--ink-faint);
	}

	.optional[open] > summary::before {
		transform: rotate(90deg);
	}

	.optional-hint {
		color: var(--ink-faint);
		font-style: italic;
	}

	.tag-input-wrap {
		margin-top: 0.5rem;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0.4rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-raised);
		min-height: 2.5rem;
		align-items: center;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.55rem;
		background: var(--accent-muted);
		color: var(--ink);
		border-radius: 999px;
		font-size: 0.8rem;
	}

	.tag-remove {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		cursor: pointer;
		font-size: 0.95rem;
		line-height: 1;
		padding: 0 0.1rem;
	}

	.tag-remove:hover {
		color: var(--accent);
	}

	.tag-input {
		flex: 1;
		min-width: 120px;
		border: none;
		background: transparent;
		outline: none;
		padding: 0.25rem;
		font-size: 0.9rem;
		color: var(--ink);
	}

	.hint {
		margin-top: 0.35rem;
		font-size: 0.7rem;
		color: var(--ink-faint);
	}

	.error {
		padding: 0.5rem 0.75rem;
		background: rgba(184, 110, 43, 0.1);
		color: var(--accent-hover);
		border-radius: var(--radius);
		font-size: 0.8rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background-color 120ms ease, color 120ms ease, opacity 120ms ease;
	}

	.btn-ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn-ghost:hover {
		background: var(--accent-muted);
		color: var(--ink);
	}

	.btn-primary {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
		font-weight: 600;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.small-print {
		margin: 0;
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-align: center;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes pop-in {
		from { opacity: 0; transform: translateY(8px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	@media (max-width: 480px) {
		.modal {
			max-width: 100%;
			border-radius: var(--radius);
		}
	}
</style>
