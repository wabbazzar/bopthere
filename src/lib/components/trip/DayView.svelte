<script lang="ts">
	import type { Trip } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';
	import { chat } from '$lib/stores/chat';
	import ExpandableField from './ExpandableField.svelte';
	import SuggestPopover from './SuggestPopover.svelte';
	import MapLinks from './MapLinks.svelte';
	import MiniCalendar from './MiniCalendar.svelte';
	import ScriptPills from './ScriptPills.svelte';

	import { tick } from 'svelte';

	let suggestTarget: { field: string; element: HTMLElement } | null = null;

	function handleSuggest(e: CustomEvent<{ field: string; element: HTMLElement }>) {
		suggestTarget = e.detail;
	}

	function handleSuggestSubmit(e: CustomEvent<{ energy: string; interest: string }>) {
		if (!suggestTarget || !day) return;
		const { energy, interest } = e.detail;
		chat.sendSuggestion(tripId, trip, currentDayIndex, suggestTarget.field as 'morning' | 'afternoon' | 'evening', energy, interest);
		suggestTarget = null;
	}

	export let trip: Trip;
	export let tripId: string;
	export let currentDayIndex: number;

	$: day = trip.days[currentDayIndex];
	$: totalDays = trip.days.length;

	$: isToday = (() => {
		if (!day?.date) return false;
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		return day.date === today;
	})();

	// Inline location edit (in the day-nav header)
	let editingLocation = false;
	let locationDraft = '';
	let locationInput: HTMLInputElement | null = null;

	async function startEditLocation() {
		if (!day) return;
		locationDraft = day.location ?? '';
		editingLocation = true;
		await tick();
		locationInput?.focus();
		locationInput?.select();
	}

	function commitLocation() {
		if (!editingLocation) return;
		const next = locationDraft.trim();
		if (next !== (day?.location ?? '')) {
			trips.updateDayField(tripId, currentDayIndex, 'location', next);
		}
		editingLocation = false;
	}

	function cancelLocation() {
		editingLocation = false;
	}

	function onLocationKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitLocation(); }
		else if (e.key === 'Escape') { e.preventDefault(); cancelLocation(); }
	}

	function prev() { if (currentDayIndex > 0) currentDayIndex--; }
	function next() { if (currentDayIndex < totalDays - 1) currentDayIndex++; }

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
		if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	function toggleOoo() {
		trips.updateDayField(tripId, currentDayIndex, 'ooo', !day.ooo);
	}

</script>

<svelte:window on:keydown={handleKeydown} />

<div class="day-view">
	{#if day}
		<MiniCalendar {trip} bind:currentDayIndex />

		<!-- Navigation bar -->
		<div class="day-nav">
			<button class="nav-arrow" on:click={prev} disabled={currentDayIndex === 0} aria-label="Previous day">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>

			<div class="day-nav-center">
				<span class="day-nav-title">
					{day.dayOfWeek} {day.date.slice(5)} {'\u00B7'}
					{#if editingLocation}
						<input
							bind:this={locationInput}
							type="text"
							bind:value={locationDraft}
							on:blur={commitLocation}
							on:keydown={onLocationKeydown}
							placeholder="Location"
							aria-label="Edit location"
							class="location-input"
						/>
					{:else}
						<button
							type="button"
							class="location-edit-btn"
							class:location-edit-btn--empty={!day.location}
							on:click={startEditLocation}
							aria-label="Edit location"
							title="Tap to edit location"
						>
							{day.location || 'No location'}
						</button>
					{/if}
				</span>
				<span class="day-nav-subtitle">
					Day {currentDayIndex + 1} of {totalDays}
					{#if isToday}<span class="today-badge">Today</span>{/if}
				</span>
			</div>

			<button class="nav-arrow" on:click={next} disabled={currentDayIndex === totalDays - 1} aria-label="Next day">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path d="M8 4l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		</div>

		<!-- Day content fields -->
		<div class="day-fields card">
			<div class="px-4 py-1">
				<ExpandableField label="Location" value={day.location} field="location" dayIndex={currentDayIndex} {tripId} icon={'\u{1F4CD}'} />
				<ExpandableField label="Travel" value={day.travel} field="travel" dayIndex={currentDayIndex} {tripId} icon={'\u2708'} />
				<ExpandableField label="Stay" value={day.accommodation} field="accommodation" dayIndex={currentDayIndex} {tripId} icon={'\u{1F3E8}'} />
				<ExpandableField label="Morning" value={day.morning} field="morning" dayIndex={currentDayIndex} {tripId} suggestable on:suggest={handleSuggest} />
				<ExpandableField label="Afternoon" value={day.afternoon} field="afternoon" dayIndex={currentDayIndex} {tripId} suggestable on:suggest={handleSuggest} />
				<ExpandableField label="Evening" value={day.evening} field="evening" dayIndex={currentDayIndex} {tripId} suggestable on:suggest={handleSuggest} />
				<ExpandableField label="Notes" value={day.notes} field="notes" dayIndex={currentDayIndex} {tripId} />
				<ScriptPills {tripId} dayIndex={currentDayIndex} />
			</div>
			<MapLinks
				{tripId}
				dayIndex={currentDayIndex}
				mapLinks={day.mapLinks ?? []}
				defaultFrom={day.accommodation ?? ''}
			/>
		</div>

		<!-- Actions bar -->
		<div class="day-actions">
			<button class="day-action-btn" on:click={toggleOoo}>
				{#if day.ooo}
					<span class="badge badge-warn">Heather OOO</span>
				{:else}
					<span class="text-xs" style="color: var(--ink-faint)">OOO</span>
				{/if}
			</button>
		</div>
	{/if}

	{#if suggestTarget && day}
		<SuggestPopover
			location={day.location}
			slot={suggestTarget.field}
			anchor={suggestTarget.element}
			on:submit={handleSuggestSubmit}
			on:close={() => (suggestTarget = null)}
		/>
	{/if}
</div>

<style>
	.day-view {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		touch-action: pan-y;
	}

	/* Navigation */
	.day-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.nav-arrow {
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--ink-muted);
		min-width: 44px;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 150ms ease, background 150ms ease;
	}
	.nav-arrow:hover:not(:disabled) {
		border-color: var(--accent);
		background: var(--accent-muted);
	}
	.nav-arrow:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.day-nav-center {
		text-align: center;
		flex: 1;
		min-width: 0;
	}
	.day-nav-title {
		display: block;
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.day-nav-subtitle {
		display: block;
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-top: 0.125rem;
	}

	.today-badge {
		display: inline-block;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--surface);
		background: var(--accent);
		padding: 1px 5px;
		border-radius: 4px;
		margin-left: 0.35rem;
		vertical-align: middle;
	}
	.location-edit-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
		border-bottom: 1px dashed transparent;
		transition: border-color 150ms ease, color 150ms ease;
	}
	.location-edit-btn:hover {
		border-bottom-color: var(--accent);
	}
	.location-edit-btn--empty {
		color: var(--ink-faint);
		font-style: italic;
		font-weight: 500;
	}
	.location-input {
		font: inherit;
		font-weight: 600;
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 4px;
		padding: 0 0.25rem;
		max-width: 60%;
		min-width: 6rem;
	}

	/* Fields card */
	.day-fields {
		flex: 1;
	}

	/* Actions */
	.day-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.25rem 0;
	}
	.day-action-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem 0.75rem;
		min-height: 44px;
		display: flex;
		align-items: center;
		font-family: var(--font-body);
	}
	.day-action-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
