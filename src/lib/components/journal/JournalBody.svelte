<script lang="ts">
	import { journalStore } from '$lib/stores/journal';

	export let tripId: string;
	export let dayIndex: number;
	export let body: string;

	let draft = body;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	// Sync draft when the entry changes from outside (e.g., store update)
	$: draft = body;

	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			journalStore.updateBody(tripId, dayIndex, draft);
			saveTimer = null;
		}, 2000);
	}

	function onInput(e: Event) {
		draft = (e.target as HTMLTextAreaElement).value;
		autoGrow(e.target as HTMLTextAreaElement);
		scheduleSave();
	}

	function onBlur() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		if (draft !== body) {
			journalStore.updateBody(tripId, dayIndex, draft);
		}
	}

	function autoGrow(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = Math.max(120, el.scrollHeight) + 'px';
	}

	function initTextarea(el: HTMLTextAreaElement): { destroy?: () => void } {
		autoGrow(el);
		return {};
	}
</script>

<section class="body-section">
	<h3 class="section-label">Journal</h3>
	<textarea
		class="journal-textarea"
		placeholder="Write about your day..."
		value={draft}
		on:input={onInput}
		on:blur={onBlur}
		use:initTextarea
		rows="5"
	></textarea>
</section>

<style>
	.body-section {
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

	.journal-textarea {
		width: 100%;
		min-height: 120px;
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--ink);
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem;
		resize: none;
		line-height: 1.55;
		transition: border-color 150ms ease;
	}

	.journal-textarea:focus {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
		border-color: var(--accent);
	}

	.journal-textarea::placeholder {
		color: var(--ink-faint);
		font-style: italic;
	}
</style>
