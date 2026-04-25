<script lang="ts">
	import type {
		ChatMessage,
		TripUpdate,
		MapLinksAction,
		TripCreate,
		TripDayOp,
		TripMetaAction,
		TripLinkOp,
		TodoOp,
		TourScriptAction
	} from '$lib/types/chat';
	import { chat } from '$lib/stores/chat';
	import { stripAllActionBlocks } from '$lib/services/chat-actions';

	export let message: ChatMessage;
	export let pendingActions: TripUpdate[] | undefined = undefined;
	export let applied = false;
	export let pendingMapLinks: MapLinksAction[] | undefined = undefined;
	export let mapLinksApplied = false;
	export let pendingCreateTrip: TripCreate[] | undefined = undefined;
	export let createTripApplied = false;
	export let pendingDayOps: TripDayOp[] | undefined = undefined;
	export let dayOpsApplied = false;
	export let pendingMeta: TripMetaAction[] | undefined = undefined;
	export let metaApplied = false;
	export let pendingLinkOps: TripLinkOp[] | undefined = undefined;
	export let linkOpsApplied = false;
	export let pendingTodoOps: TodoOp[] | undefined = undefined;
	export let todoOpsApplied = false;
	export let pendingTourScripts: TourScriptAction[] | undefined = undefined;
	export let tourScriptsApplied = false;

	function dayOpSummary(op: TripDayOp): string {
		if (op.op === 'add') return op.afterIndex === undefined ? 'Append a new day' : `Insert a day after Day ${op.afterIndex + 1}`;
		if (op.op === 'delete') return `Delete Day ${op.dayIndex + 1}`;
		if (op.op === 'duplicate') return `Duplicate Day ${op.dayIndex + 1}`;
		return `Move Day ${op.dayIndex + 1} ${op.direction}`;
	}

	function linkOpSummary(op: TripLinkOp): string {
		if (op.op === 'add') return `Add link: ${op.url}`;
		if (op.op === 'update') return `Update link #${op.linkIndex + 1} → ${op.url}`;
		return `Delete link #${op.linkIndex + 1}`;
	}

	function todoOpSummary(op: TodoOp): string {
		if (op.op === 'add') return `Add todo: ${op.text}`;
		if (op.op === 'update') return `Edit todo #${op.todoIndex + 1} → ${op.text}`;
		if (op.op === 'toggle') return `Toggle todo #${op.todoIndex + 1}`;
		return `Delete todo #${op.todoIndex + 1}`;
	}

	const FIELD_LABELS: Record<string, string> = {
		morning: 'Morning',
		afternoon: 'Afternoon',
		evening: 'Evening',
		travel: 'Travel',
		accommodation: 'Accommodation',
		notes: 'Notes',
		location: 'Location'
	};

	function formatTime(ts: string) {
		const d = new Date(ts);
		return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function displayContent(content: string): string {
		return stripAllActionBlocks(content);
	}

	function googleMapsUrl(from: string, to: string): string {
		return `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
	}

	function multiStopUrl(action: MapLinksAction): string | null {
		const links = action.mapLinks;
		if (links.length < 2) return null;
		// Check if links chain: link[n].to === link[n+1].from
		for (let i = 0; i < links.length - 1; i++) {
			if (links[i].to !== links[i + 1].from) return null;
		}
		const stops = [links[0].from, ...links.map(l => l.to)];
		return `https://www.google.com/maps/dir/${stops.map(s => encodeURIComponent(s)).join('/')}`;
	}

	function renderMarkdown(text: string): string {
		let html = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
		html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
		html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
		html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
		html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
		html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
		html = html.replace(/\n/g, '<br>');
		html = html.replace(/<br><ul>/g, '<ul>');
		html = html.replace(/<\/ul><br>/g, '</ul>');
		html = html.replace(/<\/li><br><li>/g, '</li><li>');

		return html;
	}
</script>

<div class="msg" class:msg--user={message.role === 'user'} class:msg--assistant={message.role === 'assistant'}>
	<div class="msg-bubble">
		{@html renderMarkdown(displayContent(message.content))}

		{#if pendingActions && pendingActions.length > 0}
			<div class="action-block" aria-label="Trip update actions">
				<div class="action-summary">
					{#each pendingActions as action}
						<div class="action-item">
							Day {action.dayIndex + 1} {FIELD_LABELS[action.field] || action.field}: {action.value}
						</div>
					{/each}
				</div>
				<div class="action-buttons">
					<button class="action-btn action-apply" on:click={() => chat.applyActions(message.id)} aria-label="Apply trip updates">
						Apply to trip
					</button>
					<button class="action-btn action-dismiss" on:click={() => chat.dismissActions(message.id)} aria-label="Dismiss trip updates">
						Dismiss
					</button>
				</div>
			</div>
		{/if}

		{#if applied}
			<div class="action-applied" aria-label="Trip updates applied">
				Applied to trip
			</div>
		{/if}

		{#if pendingMapLinks && pendingMapLinks.length > 0}
			{#each pendingMapLinks as action}
				<div class="action-block" aria-label="Map link actions">
					<div class="action-summary">
						<div class="map-links-header">Day {action.dayIndex + 1} — Directions</div>
						{#each action.mapLinks as link}
							<div class="map-link-preview">
								<a href={googleMapsUrl(link.from, link.to)} target="_blank" rel="noopener noreferrer" class="map-link-anchor">
									{link.label} ↗
								</a>
								<span class="map-link-route">{link.from} → {link.to}</span>
							</div>
						{/each}
						{#if multiStopUrl(action)}
							<div class="map-link-preview map-link-composite">
								<a href={multiStopUrl(action)} target="_blank" rel="noopener noreferrer" class="map-link-anchor">
									Full day route ↗
								</a>
							</div>
						{/if}
					</div>
					<div class="action-buttons">
						<button class="action-btn action-apply" on:click={() => chat.applyMapLinks(message.id)} aria-label="Apply map links">
							Apply to trip
						</button>
						<button class="action-btn action-dismiss" on:click={() => chat.dismissMapLinks(message.id)} aria-label="Dismiss map links">
							Dismiss
						</button>
					</div>
				</div>
			{/each}
		{/if}

		{#if mapLinksApplied}
			<div class="action-applied" aria-label="Map links applied">
				Directions added to trip
			</div>
		{/if}

		{#if pendingCreateTrip && pendingCreateTrip.length > 0}
			{#each pendingCreateTrip as tc}
				<div class="action-block" aria-label="Create trip action">
					<div class="action-summary">
						<div class="create-trip-header">New trip: {tc.name}</div>
						<div class="create-trip-row">{tc.startDate} → {tc.endDate}</div>
						{#if tc.destinations && tc.destinations.length > 0}
							<div class="create-trip-row">Destinations: {tc.destinations.join(' · ')}</div>
						{/if}
						{#if tc.days && tc.days.length > 0}
							<div class="create-trip-row">{tc.days.length} days planned</div>
						{/if}
					</div>
					<div class="action-buttons">
						<button class="action-btn action-apply" on:click={() => chat.applyCreateTrip(message.id)} aria-label="Create this trip">
							Add trip
						</button>
						<button class="action-btn action-dismiss" on:click={() => chat.dismissCreateTrip(message.id)} aria-label="Dismiss new trip">
							Dismiss
						</button>
					</div>
				</div>
			{/each}
		{/if}

		{#if createTripApplied}
			<div class="action-applied" aria-label="Trip created">
				Trip added
			</div>
		{/if}

		{#if pendingDayOps && pendingDayOps.length > 0}
			<div class="action-block" aria-label="Day reshape actions">
				<div class="action-summary">
					{#each pendingDayOps as op}
						<div class="action-item">{dayOpSummary(op)}</div>
					{/each}
				</div>
				<div class="action-buttons">
					<button class="action-btn action-apply" on:click={() => chat.applyDayOps(message.id)} aria-label="Apply day changes">Apply</button>
					<button class="action-btn action-dismiss" on:click={() => chat.dismissDayOps(message.id)} aria-label="Dismiss day changes">Dismiss</button>
				</div>
			</div>
		{/if}

		{#if dayOpsApplied}
			<div class="action-applied" aria-label="Day changes applied">Days updated</div>
		{/if}

		{#if pendingMeta && pendingMeta.length > 0}
			<div class="action-block" aria-label="Trip meta actions">
				<div class="action-summary">
					{#each pendingMeta as meta}
						{#if meta.name}
							<div class="action-item">Trip name → {meta.name}</div>
						{/if}
						{#if meta.startDate}
							<div class="action-item">Start date → {meta.startDate}</div>
						{/if}
						{#if meta.endDate}
							<div class="action-item">End date → {meta.endDate}</div>
						{/if}
						{#if meta.destinations}
							<div class="action-item">Destinations → {meta.destinations.join(' · ')}</div>
						{/if}
					{/each}
				</div>
				<div class="action-buttons">
					<button class="action-btn action-apply" on:click={() => chat.applyMeta(message.id)} aria-label="Apply trip meta">Apply</button>
					<button class="action-btn action-dismiss" on:click={() => chat.dismissMeta(message.id)} aria-label="Dismiss trip meta">Dismiss</button>
				</div>
			</div>
		{/if}

		{#if metaApplied}
			<div class="action-applied" aria-label="Trip meta applied">Trip details updated</div>
		{/if}

		{#if pendingLinkOps && pendingLinkOps.length > 0}
			<div class="action-block" aria-label="Trip link actions">
				<div class="action-summary">
					{#each pendingLinkOps as op}
						<div class="action-item">{linkOpSummary(op)}</div>
					{/each}
				</div>
				<div class="action-buttons">
					<button class="action-btn action-apply" on:click={() => chat.applyLinkOps(message.id)} aria-label="Apply link changes">Apply</button>
					<button class="action-btn action-dismiss" on:click={() => chat.dismissLinkOps(message.id)} aria-label="Dismiss link changes">Dismiss</button>
				</div>
			</div>
		{/if}

		{#if linkOpsApplied}
			<div class="action-applied" aria-label="Link changes applied">Links updated</div>
		{/if}

		{#if pendingTodoOps && pendingTodoOps.length > 0}
			<div class="action-block" aria-label="Todo actions">
				<div class="action-summary">
					{#each pendingTodoOps as op}
						<div class="action-item">{todoOpSummary(op)}</div>
					{/each}
				</div>
				<div class="action-buttons">
					<button class="action-btn action-apply" on:click={() => chat.applyTodoOps(message.id)} aria-label="Apply todo changes">Apply</button>
					<button class="action-btn action-dismiss" on:click={() => chat.dismissTodoOps(message.id)} aria-label="Dismiss todo changes">Dismiss</button>
				</div>
			</div>
		{/if}

		{#if todoOpsApplied}
			<div class="action-applied" aria-label="Todos applied">Todos updated</div>
		{/if}

		{#if pendingTourScripts && pendingTourScripts.length > 0}
			<div class="action-block" aria-label="Tour script actions">
				<div class="action-summary">
					{#each pendingTourScripts as script}
						<div class="action-item">
							<span class="tour-script-label">Tour Script: {script.title}</span>
							<span class="tour-script-day">Day {script.dayIndex + 1}</span>
							<div class="tour-script-preview">{script.content.slice(0, 150).replace(/^#\s+.*\n*/m, '')}...</div>
						</div>
					{/each}
				</div>
				<div class="action-buttons">
					<button class="action-btn action-apply" on:click={() => chat.applyTourScripts(message.id)} aria-label="Save tour scripts">
						Save scripts
					</button>
					<button class="action-btn action-dismiss" on:click={() => chat.dismissTourScripts(message.id)} aria-label="Dismiss tour scripts">
						Dismiss
					</button>
				</div>
			</div>
		{/if}

		{#if tourScriptsApplied}
			<div class="action-applied" aria-label="Tour scripts saved">Tour scripts saved</div>
		{/if}
	</div>
	<span class="msg-time">{formatTime(message.timestamp)}</span>
</div>

<style>
	.msg {
		display: flex;
		flex-direction: column;
		max-width: 85%;
		margin-bottom: 0.75rem;
	}

	.msg--user {
		align-self: flex-end;
		align-items: flex-end;
	}

	.msg--assistant {
		align-self: flex-start;
		align-items: flex-start;
	}

	.msg-bubble {
		padding: 0.625rem 0.875rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
		line-height: 1.55;
	}

	.msg--user .msg-bubble {
		background: var(--accent-muted);
		color: var(--ink);
		border-bottom-right-radius: 0.15rem;
	}

	.msg--assistant .msg-bubble {
		background: var(--surface-alt);
		color: var(--ink);
		border: 1px solid var(--border);
		border-bottom-left-radius: 0.15rem;
	}

	.msg-time {
		font-size: 0.65rem;
		color: var(--ink-faint);
		margin-top: 0.2rem;
		padding: 0 0.25rem;
	}

	.msg-bubble :global(strong) {
		font-weight: 600;
	}

	.msg-bubble :global(em) {
		font-style: italic;
	}

	.msg-bubble :global(a) {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.msg-bubble :global(code) {
		background: var(--surface-alt);
		padding: 0.1em 0.3em;
		border-radius: 3px;
		font-size: 0.85em;
	}

	.msg-bubble :global(ul) {
		margin: 0.35em 0;
		padding-left: 1.25em;
		list-style: disc;
	}

	.msg-bubble :global(li) {
		margin-bottom: 0.2em;
	}

	.action-block {
		margin-top: 0.625rem;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--border);
	}

	.action-summary {
		font-size: 0.78rem;
		color: var(--ink-muted);
		margin-bottom: 0.5rem;
	}

	.action-item {
		padding: 0.2rem 0;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		font-family: var(--font-body);
		font-size: 0.75rem;
		padding: 0.3rem 0.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		cursor: pointer;
		transition: background 150ms ease, color 150ms ease;
	}

	.action-apply {
		background: var(--accent);
		color: var(--surface);
		border-color: var(--accent);
	}

	.action-apply:hover {
		opacity: 0.85;
	}

	.action-dismiss {
		background: transparent;
		color: var(--ink-faint);
	}

	.action-dismiss:hover {
		background: var(--surface-raised);
		color: var(--ink-muted);
	}

	.action-applied {
		margin-top: 0.5rem;
		padding-top: 0.375rem;
		border-top: 1px dashed var(--border);
		font-size: 0.75rem;
		color: var(--ink-faint);
		font-style: italic;
	}

	.map-links-header {
		font-weight: 600;
		font-size: 0.78rem;
		margin-bottom: 0.35rem;
	}

	.map-link-preview {
		padding: 0.25rem 0;
	}

	.map-link-anchor {
		display: inline-block;
		font-size: 0.78rem;
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.map-link-route {
		display: block;
		font-size: 0.65rem;
		color: var(--ink-faint);
		word-break: break-word;
	}

	.map-link-composite {
		margin-top: 0.25rem;
		padding-top: 0.25rem;
		border-top: 1px dotted var(--border);
	}

	.create-trip-header {
		font-weight: 600;
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
	}

	.create-trip-row {
		font-size: 0.75rem;
		color: var(--ink-muted);
		padding: 0.1rem 0;
	}

	.tour-script-label {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.tour-script-day {
		font-size: 0.7rem;
		color: var(--ink-faint);
		margin-left: 0.5rem;
	}

	.tour-script-preview {
		font-size: 0.72rem;
		color: var(--ink-faint);
		margin-top: 0.2rem;
		line-height: 1.4;
	}
</style>
