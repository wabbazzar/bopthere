<script lang="ts">
	import type { MapLink } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';
	import { tick } from 'svelte';

	export let tripId: string;
	export let dayIndex: number;
	export let mapLinks: MapLink[] = [];
	/** Default "from" for a brand-new first link (usually the day's accommodation). */
	export let defaultFrom: string = '';

	let editingIndex: number | null = null;
	let adding = false;
	let draft: MapLink = { label: '', from: '', to: '' };
	let firstFieldEl: HTMLInputElement | undefined;

	function googleMapsUrl(from: string, to: string): string {
		return `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
	}

	function multiStopUrl(): string | null {
		if (mapLinks.length < 2) return null;
		for (let i = 0; i < mapLinks.length - 1; i++) {
			if (mapLinks[i].to !== mapLinks[i + 1].from) return null;
		}
		const stops = [mapLinks[0].from, ...mapLinks.map((l) => l.to)];
		return `https://www.google.com/maps/dir/${stops.map((s) => encodeURIComponent(s)).join('/')}`;
	}

	$: fullRouteUrl = multiStopUrl();

	function startAdd() {
		adding = true;
		editingIndex = null;
		const lastTo = mapLinks.length > 0 ? mapLinks[mapLinks.length - 1].to : '';
		draft = {
			label: '',
			// Chain from the previous link's "to"; otherwise fall back to
			// the day's accommodation so the common case is one click.
			from: lastTo || defaultFrom || '',
			to: ''
		};
		tick().then(() => firstFieldEl?.focus());
	}

	function startEdit(i: number) {
		editingIndex = i;
		adding = false;
		draft = { ...mapLinks[i] };
		tick().then(() => firstFieldEl?.focus());
	}

	function cancel() {
		editingIndex = null;
		adding = false;
		draft = { label: '', from: '', to: '' };
	}

	function save() {
		const trimmed: MapLink = {
			label: draft.label.trim(),
			from: draft.from.trim(),
			to: draft.to.trim()
		};
		if (!trimmed.label || !trimmed.from || !trimmed.to) return;
		const next = [...mapLinks];
		if (adding) {
			next.push(trimmed);
		} else if (editingIndex !== null) {
			next[editingIndex] = trimmed;
		}
		trips.setDayMapLinks(tripId, dayIndex, next);
		cancel();
	}

	function remove(i: number) {
		const next = mapLinks.filter((_, j) => j !== i);
		trips.setDayMapLinks(tripId, dayIndex, next);
		if (editingIndex === i) cancel();
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			save();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		}
	}

	$: canSave = draft.label.trim() && draft.from.trim() && draft.to.trim();
</script>

<div class="map-section">
	<div class="map-header">
		<p class="map-heading">
			<svg class="map-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
				<line x1="8" y1="2" x2="8" y2="18" />
				<line x1="16" y1="6" x2="16" y2="22" />
			</svg>
			Directions
		</p>
		{#if !adding && editingIndex === null}
			<button type="button" class="add-btn" aria-label="Add directions link" on:click={startAdd}>
				+ Add
			</button>
		{/if}
	</div>

	{#if mapLinks.length > 0}
		<div class="map-links">
			{#each mapLinks as link, i}
				{#if editingIndex === i}
					<form class="link-editor" on:submit|preventDefault={save}>
						<input
							bind:this={firstFieldEl}
							type="text"
							placeholder="Label (e.g. Hotel to Eiffel Tower)"
							bind:value={draft.label}
							on:keydown={handleKey}
							class="link-input"
							aria-label="Label"
						/>
						<input type="text" placeholder="From" bind:value={draft.from} on:keydown={handleKey} class="link-input" aria-label="From" />
						<input type="text" placeholder="To" bind:value={draft.to} on:keydown={handleKey} class="link-input" aria-label="To" />
						<div class="editor-actions">
							<button type="button" class="editor-btn editor-btn--ghost" on:click={cancel}>Cancel</button>
							<button type="submit" class="editor-btn editor-btn--primary" disabled={!canSave}>Save</button>
						</div>
					</form>
				{:else}
					<div class="map-link-row">
						<a
							href={googleMapsUrl(link.from, link.to)}
							target="_blank"
							rel="noopener"
							class="map-link"
						>
							<span class="map-link-icon">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<circle cx="12" cy="10" r="3" />
									<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
								</svg>
							</span>
							<span class="map-link-text">
								<span class="map-link-label">{link.label}</span>
								<span class="map-link-route">{link.from} → {link.to}</span>
							</span>
							<span class="map-link-arrow">↗</span>
						</a>
						<div class="row-actions">
							<button type="button" class="icon-btn" aria-label="Edit {link.label}" on:click={() => startEdit(i)}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
							</button>
							<button type="button" class="icon-btn" aria-label="Delete {link.label}" on:click={() => remove(i)}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
							</button>
						</div>
					</div>
				{/if}
			{/each}

			{#if fullRouteUrl && editingIndex === null && !adding}
				<a href={fullRouteUrl} target="_blank" rel="noopener" class="map-link map-link--composite">
					<span class="map-link-icon">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
						</svg>
					</span>
					<span class="map-link-text">
						<span class="map-link-label">Full day route</span>
						<span class="map-link-route">{mapLinks.length + 1} stops</span>
					</span>
					<span class="map-link-arrow">↗</span>
				</a>
			{/if}
		</div>
	{:else if !adding}
		<p class="empty-hint">No directions yet. Tap <strong>+ Add</strong> to create a map link.</p>
	{/if}

	{#if adding}
		<form class="link-editor" on:submit|preventDefault={save}>
			<input
				bind:this={firstFieldEl}
				type="text"
				placeholder="Label (e.g. Hotel to Eiffel Tower)"
				bind:value={draft.label}
				on:keydown={handleKey}
				class="link-input"
				aria-label="Label"
			/>
			<input type="text" placeholder="From" bind:value={draft.from} on:keydown={handleKey} class="link-input" aria-label="From" />
			<input type="text" placeholder="To" bind:value={draft.to} on:keydown={handleKey} class="link-input" aria-label="To" />
			<div class="editor-actions">
				<button type="button" class="editor-btn editor-btn--ghost" on:click={cancel}>Cancel</button>
				<button type="submit" class="editor-btn editor-btn--primary" disabled={!canSave}>Add</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.map-section {
		border-top: 1px solid var(--border);
		padding: 0.75rem 1rem;
	}

	.map-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.map-heading {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-family: var(--font-display);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-muted);
		margin: 0;
	}

	.map-icon {
		color: var(--ink-faint);
		flex-shrink: 0;
	}

	.add-btn {
		font-family: inherit;
		font-size: 0.7rem;
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: transparent;
		color: var(--accent);
		cursor: pointer;
		transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
	}

	.add-btn:hover {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
	}

	.map-links {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.map-link-row {
		display: flex;
		align-items: stretch;
		gap: 0.375rem;
	}

	.map-link {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		text-decoration: none;
		color: var(--ink);
		transition: border-color 200ms ease, background-color 150ms ease, box-shadow 200ms ease;
		min-width: 0;
	}

	.map-link:hover {
		border-color: var(--accent);
		background-color: var(--accent-muted);
		box-shadow: 0 1px 4px rgba(184, 110, 43, 0.08);
	}

	.map-link-icon {
		color: var(--accent);
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.map-link-text {
		flex: 1;
		min-width: 0;
	}

	.map-link-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.map-link-route {
		display: block;
		font-size: 0.65rem;
		color: var(--ink-faint);
		line-height: 1.4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.map-link-arrow {
		font-size: 0.7rem;
		color: var(--ink-faint);
		flex-shrink: 0;
		margin-top: 0.125rem;
		transition: color 150ms ease;
	}

	.map-link:hover .map-link-arrow {
		color: var(--accent);
	}

	.map-link--composite {
		border-style: dashed;
	}

	.row-actions {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		justify-content: center;
	}

	.icon-btn {
		width: 26px;
		height: 26px;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
	}

	.icon-btn:hover {
		background: var(--accent-muted);
		color: var(--accent);
		border-color: var(--accent);
	}

	.link-editor {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-raised);
	}

	.link-input {
		padding: 0.4rem 0.55rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink);
		font-size: 0.8rem;
		font-family: inherit;
		transition: border-color 120ms ease, box-shadow 120ms ease;
	}

	.link-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-muted);
	}

	.editor-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	.editor-btn {
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: background-color 120ms ease, color 120ms ease, opacity 120ms ease;
	}

	.editor-btn--ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.editor-btn--ghost:hover {
		background: var(--accent-muted);
		color: var(--ink);
	}

	.editor-btn--primary {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
		font-weight: 600;
	}

	.editor-btn--primary:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.editor-btn--primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.empty-hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--ink-faint);
	}
</style>
