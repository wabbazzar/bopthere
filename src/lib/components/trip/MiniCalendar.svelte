<script lang="ts">
	import type { Trip } from '$lib/types/trip';

	export let trip: Trip;
	export let currentDayIndex: number;

	// Group days into weeks of 7
	$: weeks = (() => {
		const result: number[][] = [];
		for (let i = 0; i < trip.days.length; i += 7) {
			result.push(Array.from({ length: Math.min(7, trip.days.length - i) }, (_, j) => i + j));
		}
		return result;
	})();

	// Map locations to subtle color hints (first letter as key)
	const locationColors: Record<string, string> = {};
	let colorIndex = 0;
	const palette = [
		'var(--accent)',
		'var(--ink-muted)',
		'#7b8f6a',
	];

	function getLocationDot(location: string): string {
		if (!location) return 'transparent';
		if (!(location in locationColors)) {
			locationColors[location] = palette[colorIndex % palette.length];
			colorIndex++;
		}
		return locationColors[location];
	}
</script>

<div class="mini-cal" aria-label="Trip day navigator">
	{#each weeks as week}
		<div class="mini-cal-week">
			{#each week as dayIdx}
				{@const day = trip.days[dayIdx]}
				<button
					class="mini-cal-day"
					class:active={dayIdx === currentDayIndex}
					class:ooo={day.ooo}
					on:click={() => (currentDayIndex = dayIdx)}
					aria-label="Go to day {dayIdx + 1}"
					title="{day.dayOfWeek} {day.date.slice(5)} · {day.location}"
				>
					<span class="mini-cal-num">{dayIdx + 1}</span>
					<span class="mini-cal-dot" style="background: {getLocationDot(day.location)}"></span>
				</button>
			{/each}
		</div>
	{/each}
</div>

<style>
	.mini-cal {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 0.375rem 0;
	}

	.mini-cal-week {
		display: flex;
		gap: 3px;
		justify-content: center;
	}

	.mini-cal-day {
		width: 32px;
		height: 32px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		padding: 0;
		transition: background 120ms ease, border-color 120ms ease, transform 100ms ease;
		position: relative;
	}

	.mini-cal-day:hover {
		border-color: var(--accent);
		background: var(--accent-muted);
	}

	.mini-cal-day:active {
		transform: scale(0.92);
	}

	.mini-cal-day.active {
		background: var(--accent);
		border-color: var(--accent);
	}

	.mini-cal-day.active .mini-cal-num {
		color: var(--surface);
		font-weight: 700;
	}

	.mini-cal-day.active .mini-cal-dot {
		background: var(--surface) !important;
		opacity: 0.6;
	}

	.mini-cal-day.ooo:not(.active) {
		border-style: dashed;
	}

	.mini-cal-num {
		font-family: var(--font-display);
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--ink);
		line-height: 1;
	}

	.mini-cal-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
