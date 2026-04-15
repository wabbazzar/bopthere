<script lang="ts">
	import type { Trip } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';
	import { chat } from '$lib/stores/chat';
	import ExpandableField from './ExpandableField.svelte';
	import SuggestPopover from './SuggestPopover.svelte';
	import MapLinks from './MapLinks.svelte';
	import MiniCalendar from './MiniCalendar.svelte';

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

	// Swipe detection
	let touchStartX = 0;
	let touchStartY = 0;
	let swiping = false;

	function onTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		swiping = true;
	}

	function onTouchEnd(e: TouchEvent) {
		if (!swiping) return;
		swiping = false;
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		// Only trigger if horizontal swipe is dominant and > 50px
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
			if (dx < 0 && currentDayIndex < totalDays - 1) {
				currentDayIndex++;
			} else if (dx > 0 && currentDayIndex > 0) {
				currentDayIndex--;
			}
		}
	}

	function prev() { if (currentDayIndex > 0) currentDayIndex--; }
	function next() { if (currentDayIndex < totalDays - 1) currentDayIndex++; }

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	function toggleOoo() {
		trips.updateDayField(tripId, currentDayIndex, 'ooo', !day.ooo);
	}

</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="day-view"
	on:touchstart={onTouchStart}
	on:touchend={onTouchEnd}
>
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
					{day.dayOfWeek} {day.date.slice(5)} {'\u00B7'} {day.location || 'No location'}
				</span>
				<span class="day-nav-subtitle">
					Day {currentDayIndex + 1} of {totalDays}
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
