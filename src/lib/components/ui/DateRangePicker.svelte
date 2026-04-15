<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let startDate: string = '';
	export let endDate: string = '';
	export let minYear: number = new Date().getFullYear();

	const dispatch = createEventDispatcher<{ change: { startDate: string; endDate: string } }>();

	const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const MONTHS = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	let viewYear: number;
	let viewMonth: number;
	let hoverIso: string = '';

	$: {
		const anchor = startDate || todayIso();
		const d = parseIso(anchor);
		if (!viewYear) viewYear = d.getFullYear();
		if (viewMonth === undefined) viewMonth = d.getMonth();
	}

	function todayIso(): string {
		return new Date().toISOString().split('T')[0];
	}

	function parseIso(iso: string): Date {
		return new Date(iso + 'T12:00:00');
	}

	function toIso(y: number, m: number, d: number): string {
		return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
	}

	function daysInMonth(y: number, m: number): number {
		return new Date(y, m + 1, 0).getDate();
	}

	function firstWeekday(y: number, m: number): number {
		return new Date(y, m, 1).getDay();
	}

	$: gridCells = buildCells(viewYear, viewMonth);

	function buildCells(y: number, m: number): Array<{ iso: string; day: number } | null> {
		if (y === undefined || m === undefined) return [];
		const cells: Array<{ iso: string; day: number } | null> = [];
		const lead = firstWeekday(y, m);
		const total = daysInMonth(y, m);
		for (let i = 0; i < lead; i++) cells.push(null);
		for (let d = 1; d <= total; d++) cells.push({ iso: toIso(y, m, d), day: d });
		return cells;
	}

	function isBetween(iso: string, a: string, b: string): boolean {
		if (!a || !b) return false;
		const [lo, hi] = a <= b ? [a, b] : [b, a];
		return iso > lo && iso < hi;
	}

	function isStart(iso: string, sd: string): boolean {
		return Boolean(sd) && iso === sd;
	}

	function isEnd(iso: string, sd: string, ed: string): boolean {
		return Boolean(ed) && iso === ed && iso !== sd;
	}

	function isInRange(iso: string, sd: string, ed: string): boolean {
		return Boolean(sd) && Boolean(ed) && isBetween(iso, sd, ed);
	}

	function isPreview(iso: string, sd: string, ed: string, hover: string): boolean {
		if (!sd || ed || !hover || iso === sd) return false;
		return isBetween(iso, sd, hover) || iso === hover;
	}

	function select(iso: string) {
		// Two-click range: first click sets start (and clears end);
		// second click sets end (swap if before start).
		if (!startDate || (startDate && endDate)) {
			startDate = iso;
			endDate = '';
		} else {
			if (iso < startDate) {
				endDate = startDate;
				startDate = iso;
			} else {
				endDate = iso;
			}
		}
		dispatch('change', { startDate, endDate });
	}

	function handleKey(e: KeyboardEvent, iso: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			select(iso);
		}
	}

	$: summaryText = (() => {
		if (!startDate) return 'Pick start date';
		if (!endDate) return `Start: ${startDate} — pick end date`;
		const s = parseIso(startDate);
		const e = parseIso(endDate);
		const nights = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
		return `${startDate} → ${endDate} (${nights + 1} days)`;
	})();
</script>

<div class="picker" role="group" aria-label="Trip date range">
	<div class="picker-header">
		<button type="button" class="nav-btn" aria-label="Previous month" on:click={prevMonth}>
			‹
		</button>
		<div class="month-label">{MONTHS[viewMonth]} {viewYear}</div>
		<button type="button" class="nav-btn" aria-label="Next month" on:click={nextMonth}>
			›
		</button>
	</div>

	<div class="weekdays" aria-hidden="true">
		{#each WEEKDAYS as w, i}
			<div class="weekday" class:wk={i === 0 || i === 6}>{w}</div>
		{/each}
	</div>

	<div class="grid" role="grid">
		{#each gridCells as cell}
			{#if cell === null}
				<div class="cell empty"></div>
			{:else}
				<button
					type="button"
					class="cell"
					class:start={isStart(cell.iso, startDate)}
					class:end={isEnd(cell.iso, startDate, endDate)}
					class:between={isInRange(cell.iso, startDate, endDate)}
					class:preview={isPreview(cell.iso, startDate, endDate, hoverIso)}
					aria-label={cell.iso}
					aria-pressed={isStart(cell.iso, startDate) || isEnd(cell.iso, startDate, endDate)}
					data-iso={cell.iso}
					on:click={() => select(cell.iso)}
					on:mouseenter={() => (hoverIso = cell.iso)}
					on:mouseleave={() => (hoverIso = '')}
					on:keydown={(e) => handleKey(e, cell.iso)}
				>
					{cell.day}
				</button>
			{/if}
		{/each}
	</div>

	<div class="summary" aria-live="polite">{summaryText}</div>
</div>

<style>
	.picker {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem;
		background: var(--surface-raised);
		user-select: none;
	}

	.picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.month-label {
		font-family: var(--font-display, inherit);
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--ink);
	}

	.nav-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink-muted);
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 120ms ease, color 120ms ease;
	}

	.nav-btn:hover {
		background: var(--accent-muted);
		color: var(--accent);
	}

	.weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		margin-bottom: 0.25rem;
	}

	.weekday {
		text-align: center;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
		text-transform: uppercase;
	}

	.weekday.wk {
		color: var(--ink-muted);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.cell {
		aspect-ratio: 1 / 1;
		border: none;
		background: transparent;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		color: var(--ink);
		font-family: inherit;
		transition: background-color 120ms ease, color 120ms ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cell.empty {
		cursor: default;
	}

	.cell:not(.empty):hover {
		background: var(--accent-muted);
	}

	.cell.between,
	.cell.preview {
		background: var(--accent-muted);
		color: var(--ink);
	}

	.cell.preview {
		opacity: 0.6;
	}

	.cell.start,
	.cell.end {
		background: var(--accent);
		color: var(--surface);
		font-weight: 600;
	}

	.cell.start:hover,
	.cell.end:hover {
		background: var(--accent-hover);
	}

	.summary {
		margin-top: 0.6rem;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--border);
		font-size: 0.75rem;
		color: var(--ink-muted);
		text-align: center;
	}
</style>
