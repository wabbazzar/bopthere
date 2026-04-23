<script lang="ts">
	import type { Trip } from '$lib/types/trip';
	import { journalStore } from '$lib/stores/journal';

	export let trip: Trip;
	export let currentDayIndex: number;

	const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

	/** Mon=0 .. Sun=6 — JS Date.getDay() is Sun=0 .. Sat=6 */
	function mondayIndex(dateStr: string): number {
		if (!dateStr) return 0;
		const d = new Date(dateStr + 'T12:00:00');
		if (isNaN(d.getTime())) return 0;
		return (d.getDay() + 6) % 7;
	}

	// Lay days out on a Mon-Sun calendar grid: leading blanks before day 1
	// based on its weekday, then sequential day indices, then trailing blanks
	// to fill the last row.
	$: weeks = (() => {
		const days = trip.days;
		if (days.length === 0) return [] as (number | null)[][];
		const lead = mondayIndex(days[0].date);
		const cells: (number | null)[] = Array.from({ length: lead }, () => null);
		for (let i = 0; i < days.length; i++) cells.push(i);
		while (cells.length % 7 !== 0) cells.push(null);
		const rows: (number | null)[][] = [];
		for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
		return rows;
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

<div class="mini-cal" aria-label="Trip day navigator" data-testid="mini-cal">
	<div class="mini-cal-week mini-cal-headers" aria-hidden="true" data-testid="mini-cal-headers">
		{#each WEEKDAY_HEADERS as label}
			<span class="mini-cal-header">{label}</span>
		{/each}
	</div>
	{#each weeks as week, weekIdx (weekIdx)}
		<div class="mini-cal-week" data-testid="mini-cal-week">
			{#each week as dayIdx}
				{#if dayIdx === null}
					<span class="mini-cal-day mini-cal-day--blank" aria-hidden="true" data-testid="mini-cal-blank"></span>
				{:else}
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
						<span class="mini-cal-dots">
							<span class="mini-cal-dot" style="background: {getLocationDot(day.location)}"></span>
							{#if ($journalStore[trip.id] ?? []).some((e) => e.dayIndex === dayIdx)}
								<span class="mini-cal-dot mini-cal-dot--journal"></span>
							{/if}
						</span>
					</button>
				{/if}
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
		display: grid;
		grid-template-columns: repeat(7, 32px);
		gap: 3px;
		justify-content: center;
	}

	.mini-cal-headers {
		margin-bottom: 2px;
	}
	.mini-cal-header {
		font-family: var(--font-display);
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		text-align: center;
		line-height: 1;
		padding: 2px 0;
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

	.mini-cal-day--blank {
		border: none;
		background: transparent;
		cursor: default;
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

	.mini-cal-day.active .mini-cal-dot--journal {
		background: var(--surface) !important;
		opacity: 0.8;
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

	.mini-cal-dots {
		display: flex;
		gap: 2px;
		align-items: center;
	}

	.mini-cal-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.mini-cal-dot--journal {
		background: var(--accent);
	}
</style>
