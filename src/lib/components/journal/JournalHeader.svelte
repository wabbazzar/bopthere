<script lang="ts">
	import type { JournalEntry } from '$lib/types/trip';
	import { journalStore } from '$lib/stores/journal';

	export let tripId: string;
	export let dayIndex: number;
	export let mood: JournalEntry['mood'];
	export let weather: string | undefined;

	type MoodOption = { value: JournalEntry['mood']; label: string };

	const moods: MoodOption[] = [
		{ value: 'great', label: 'Great' },
		{ value: 'good', label: 'Good' },
		{ value: 'okay', label: 'Okay' },
		{ value: 'tough', label: 'Tough' }
	];

	function selectMood(value: JournalEntry['mood']) {
		journalStore.setMood(tripId, dayIndex, mood === value ? undefined : value);
	}

	function onWeatherBlur(e: FocusEvent) {
		const value = (e.target as HTMLInputElement).value;
		journalStore.setWeather(tripId, dayIndex, value);
	}
</script>

<div class="journal-header">
	<div class="mood-section">
		<span class="mini-label">Mood</span>
		<div class="mood-row">
			{#each moods as m}
				<button
					class="mood-btn"
					class:selected={mood === m.value}
					on:click={() => selectMood(m.value)}
					aria-label="Mood: {m.label}"
					title={m.label}
				>
					{#if m.value === 'great'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
							<path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							<circle cx="9" cy="9" r="1" fill="currentColor"/>
							<circle cx="15" cy="9" r="1" fill="currentColor"/>
							<path d="M7 7l2 1M17 7l-2 1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
						</svg>
					{:else if m.value === 'good'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
							<path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							<circle cx="9" cy="9" r="1" fill="currentColor"/>
							<circle cx="15" cy="9" r="1" fill="currentColor"/>
						</svg>
					{:else if m.value === 'okay'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
							<line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							<circle cx="9" cy="9" r="1" fill="currentColor"/>
							<circle cx="15" cy="9" r="1" fill="currentColor"/>
						</svg>
					{:else}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
							<path d="M8 16s1.5-2 4-2 4 2 4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
							<circle cx="9" cy="9" r="1" fill="currentColor"/>
							<circle cx="15" cy="9" r="1" fill="currentColor"/>
						</svg>
					{/if}
					<span class="mood-label">{m.label}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="weather-section">
		<span class="mini-label">Weather</span>
		<input
			type="text"
			class="weather-input"
			value={weather ?? ''}
			on:blur={onWeatherBlur}
			placeholder="Sunny, rainy..."
		/>
	</div>
</div>

<style>
	.journal-header {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.mood-section {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1;
		min-width: 180px;
	}

	.weather-section {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1;
		min-width: 120px;
	}

	.mini-label {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}

	.mood-row {
		display: flex;
		gap: 0.25rem;
	}

	.mood-btn {
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--ink-faint);
		padding: 0.35rem 0.45rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
		flex: 1;
		min-height: 44px;
		justify-content: center;
	}

	.mood-btn:hover {
		border-color: var(--accent);
		color: var(--ink-muted);
	}

	.mood-btn.selected {
		border-color: var(--accent);
		background: var(--accent-muted);
		color: var(--accent);
	}

	.mood-label {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.weather-input {
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--ink);
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.5rem 0.6rem;
		min-height: 44px;
	}

	.weather-input:focus {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
	}

	.weather-input::placeholder {
		color: var(--ink-faint);
	}
</style>
