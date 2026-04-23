<script lang="ts">
	import type { ItineraryCheckItem } from '$lib/types/trip';
	import { journalStore } from '$lib/stores/journal';

	export let tripId: string;
	export let dayIndex: number;
	export let itinerary: ItineraryCheckItem[];

	let expandedNotes: Set<number> = new Set();

	const slotLabels: Record<string, string> = {
		travel: 'Travel',
		morning: 'Morning',
		afternoon: 'Afternoon',
		evening: 'Evening'
	};

	function toggle(itemIndex: number) {
		journalStore.toggleItineraryItem(tripId, dayIndex, itemIndex);
	}

	function toggleNotes(itemIndex: number) {
		if (expandedNotes.has(itemIndex)) {
			expandedNotes.delete(itemIndex);
		} else {
			expandedNotes.add(itemIndex);
		}
		expandedNotes = expandedNotes;
	}

	function updateNotes(itemIndex: number, value: string) {
		journalStore.updateItineraryNotes(tripId, dayIndex, itemIndex, value);
	}
</script>

{#if itinerary.length > 0}
	<section class="checklist-section">
		<h3 class="section-label">Itinerary</h3>
		<div class="checklist">
			{#each itinerary as item, i}
				<div class="checklist-item">
					<button
						class="check-row"
						on:click={() => toggle(i)}
						aria-label="{item.done ? 'Uncheck' : 'Check'} {slotLabels[item.slot]}"
					>
						<span class="checkbox" class:checked={item.done}>
							{#if item.done}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
									<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							{/if}
						</span>
						<span class="check-content">
							<span class="slot-label">{slotLabels[item.slot]}</span>
							<span class="plan-text" class:done={item.done}>{item.text}</span>
						</span>
					</button>
					<button
						class="notes-toggle"
						on:click={() => toggleNotes(i)}
						aria-label="Add notes for {slotLabels[item.slot]}"
						title={item.notes ? 'Edit notes' : 'Add notes'}
					>
						{#if item.notes}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
								<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
								<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
							</svg>
						{:else}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
								<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						{/if}
					</button>

					{#if expandedNotes.has(i)}
						<div class="notes-area">
							<textarea
								class="notes-input"
								placeholder="What actually happened..."
								value={item.notes ?? ''}
								on:blur={(e) => updateNotes(i, e.currentTarget.value)}
								rows="2"
							></textarea>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</section>
{/if}

<style>
	.checklist-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
		margin: 0;
	}

	.checklist {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.checklist-item {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.check-row {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.6rem 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
		min-height: 44px;
		font-family: var(--font-body);
		transition: background 120ms ease;
	}

	.check-row:hover {
		background: var(--surface-alt);
	}

	.checkbox {
		width: 20px;
		height: 20px;
		border: 2px solid var(--border);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 1px;
		transition: border-color 120ms ease, background 120ms ease;
	}

	.checkbox.checked {
		border-color: var(--success);
		background: var(--success);
		color: white;
	}

	.check-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 0;
	}

	.slot-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}

	.plan-text {
		font-size: 0.85rem;
		color: var(--ink);
		line-height: 1.35;
		word-break: break-word;
	}

	.plan-text.done {
		text-decoration: line-through;
		color: var(--ink-faint);
	}

	.notes-toggle {
		position: absolute;
		right: 0.5rem;
		top: 0.6rem;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--ink-faint);
		padding: 0.25rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 120ms ease;
	}

	.notes-toggle:hover {
		color: var(--accent);
	}

	.checklist-item {
		position: relative;
	}

	.notes-area {
		padding: 0 0.75rem 0.6rem;
		border-top: 1px solid var(--border);
	}

	.notes-input {
		width: 100%;
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--ink);
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.5rem 0.6rem;
		margin-top: 0.5rem;
		resize: vertical;
		line-height: 1.4;
	}

	.notes-input:focus {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
	}
</style>
