<script lang="ts">
	import type { JournalBlock, JournalPhotoBlock } from '$lib/types/trip';
	import { journalStore } from '$lib/stores/journal';
	import { uploadPhoto } from '$lib/services/photo-upload';
	import { queueUpload } from '$lib/services/photo-queue';
	import JournalTextBlock from './JournalTextBlock.svelte';
	import JournalPhotoBlockComponent from './JournalPhotoBlock.svelte';

	export let tripId: string;
	export let dayIndex: number;
	export let blocks: JournalBlock[];

	let fileInput: HTMLInputElement;
	let activeTextBlockId: string | null = null;
	let textBlockRefs: Record<string, JournalTextBlock> = {};
	let pendingSave: { tripId: string; dayIndex: number; blockId: string; content: string } | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let dragOver = false;

	/** Flush any pending text save immediately. */
	function flushPendingSave() {
		if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
		if (pendingSave) {
			journalStore.updateBlockContent(pendingSave.tripId, pendingSave.dayIndex, pendingSave.blockId, pendingSave.content);
			pendingSave = null;
		}
	}

	// Flush pending save when dayIndex changes (user switching days)
	$: dayIndex, flushPendingSave();

	// ── Text block events ─────────────────────────────────────

	function onTextInput(e: CustomEvent<{ blockId: string; content: string }>) {
		const { blockId, content } = e.detail;
		// Capture current tripId and dayIndex by VALUE, not reference
		const saveTripId = tripId;
		const saveDayIndex = dayIndex;
		pendingSave = { tripId: saveTripId, dayIndex: saveDayIndex, blockId, content };
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			if (pendingSave) {
				journalStore.updateBlockContent(pendingSave.tripId, pendingSave.dayIndex, pendingSave.blockId, pendingSave.content);
				pendingSave = null;
			}
			saveTimer = null;
		}, 2000);
	}

	function onTextFocus(e: CustomEvent<{ blockId: string }>) {
		activeTextBlockId = e.detail.blockId;
	}

	function onTextBlur(e: CustomEvent<{ blockId: string; content: string }>) {
		// Flush immediately on blur — don't wait for debounce
		if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
		const { blockId, content } = e.detail;
		journalStore.updateBlockContent(tripId, dayIndex, blockId, content);
		pendingSave = null;
	}

	function onBackspaceAtStart(e: CustomEvent<{ blockId: string }>) {
		// Remove the empty text block (store will merge adjacent text blocks)
		const idx = blocks.findIndex((b) => b.id === e.detail.blockId);
		if (idx <= 0) return; // Can't remove the first block
		journalStore.removeBlock(tripId, dayIndex, e.detail.blockId);
		// Focus the previous text block at its end
		const prev = blocks[idx - 1];
		if (prev?.type === 'text') {
			requestAnimationFrame(() => textBlockRefs[prev.id]?.focusAtEnd());
		}
	}

	// ── Photo events ──────────────────────────────────────────

	function onPhotoDelete(e: CustomEvent<{ blockId: string }>) {
		journalStore.removeBlock(tripId, dayIndex, e.detail.blockId);
	}

	function onCaptionEdit(e: CustomEvent<{ blockId: string; caption: string }>) {
		journalStore.updatePhotoCaption(tripId, dayIndex, e.detail.blockId, e.detail.caption);
	}

	// ── Photo insertion ───────────────────────────────────────

	function triggerAddPhoto(afterBlockId: string | null) {
		activeTextBlockId = afterBlockId;
		fileInput?.click();
	}

	function onFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) insertPhotoFile(file);
		input.value = '';
	}

	function insertPhotoFile(file: File) {
		if (!file.type.startsWith('image/')) return;

		const localUrl = URL.createObjectURL(file);
		const photoBlock: JournalPhotoBlock = {
			id: crypto.randomUUID(),
			type: 'photo',
			photoId: '',
			caption: '',
			uploadedBy: '',
			_localObjectUrl: localUrl,
			_uploadPending: true
		};

		if (activeTextBlockId) {
			const ref = textBlockRefs[activeTextBlockId];
			const block = blocks.find((b) => b.id === activeTextBlockId);
			if (ref && block?.type === 'text') {
				const cursorPos = ref.getCursorPosition();
				journalStore.splitAndInsertPhoto(tripId, dayIndex, activeTextBlockId, cursorPos, photoBlock);
			} else {
				journalStore.insertBlock(tripId, dayIndex, activeTextBlockId, photoBlock);
			}
		} else {
			const lastBlockId = blocks.length > 0 ? blocks[blocks.length - 1].id : null;
			journalStore.insertBlock(tripId, dayIndex, lastBlockId, photoBlock);
		}

		// Ensure a text block follows the photo for continued typing
		requestAnimationFrame(() => {
			const updatedBlocks = blocks;
			const photoIdx = updatedBlocks.findIndex((b) => b.id === photoBlock.id);
			if (photoIdx !== -1 && photoIdx === updatedBlocks.length - 1) {
				// Photo is last block — add an empty text block after it
				journalStore.insertBlock(tripId, dayIndex, photoBlock.id, {
					id: crypto.randomUUID(),
					type: 'text',
					content: ''
				});
			}
		});

		// Upload to server
		uploadPhoto(tripId, file)
			.then(async ({ filename }) => {
				// Pre-resolve the signed URL before swapping out the blob URL
				// so the photo never disappears during the transition
				try {
					const { getPhotoUrl } = await import('$lib/utils/signed-url-cache');
					await getPhotoUrl(tripId, filename);
				} catch {
					// Signed URL failed — updatePhotoId will trigger a lazy resolve
				}
				URL.revokeObjectURL(localUrl);
				journalStore.updatePhotoId(tripId, dayIndex, photoBlock.id, filename);
			})
			.catch(() => {
				// Upload failed — queue for retry, keep local preview.
				// Do NOT store the blob URL as photoId — blob URLs expire on reload.
				queueUpload(tripId, dayIndex, photoBlock.id, file);
			});
	}

	// ── Drag and drop ─────────────────────────────────────────

	function onDragOver(e: DragEvent) {
		if (e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			dragOver = true;
		}
	}

	function onDragLeave() {
		dragOver = false;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const files = e.dataTransfer?.files;
		if (!files) return;
		for (const file of Array.from(files)) {
			if (file.type.startsWith('image/')) {
				insertPhotoFile(file);
			}
		}
	}

	// ── Paste image from clipboard ────────────────────────────

	function onPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of Array.from(items)) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) insertPhotoFile(file);
				return;
			}
		}
		// Not an image paste — let the textarea handle it normally
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="journal-blocks"
	class:drag-over={dragOver}
	on:dragover={onDragOver}
	on:dragleave={onDragLeave}
	on:drop={onDrop}
	on:paste={onPaste}
>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="file-input-hidden"
		on:change={onFileSelected}
	/>

	{#each blocks as block, i (block.id)}
		{#if block.type === 'text'}
			<JournalTextBlock
				blockId={block.id}
				content={block.content}
				placeholder={i === 0 && !block.content ? 'Write about your day...' : ''}
				on:input={onTextInput}
				on:focus={onTextFocus}
				on:blur={onTextBlur}
				on:backspaceatstart={onBackspaceAtStart}
				bind:this={textBlockRefs[block.id]}
			/>
		{:else if block.type === 'photo'}
			<div class="photo-block-wrap">
				<JournalPhotoBlockComponent
					{block}
					{tripId}
					on:delete={onPhotoDelete}
					on:captionedit={onCaptionEdit}
				/>
			</div>
		{/if}

		<!-- Insert photo button between blocks -->
		{#if i < blocks.length - 1}
			<button
				class="insert-btn"
				on:click={() => triggerAddPhoto(block.id)}
				aria-label="Insert photo after this block"
				title="Add photo"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
					<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				</svg>
			</button>
		{/if}
	{/each}

	<!-- Add photo at end -->
	<button
		class="add-photo-end"
		on:click={() => triggerAddPhoto(blocks.length > 0 ? blocks[blocks.length - 1].id : null)}
		aria-label="Add photo"
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
			<circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
			<path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		Add photo
	</button>

	{#if dragOver}
		<div class="drop-overlay">
			<div class="drop-label">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
					<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
					<circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
					<path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				Drop photo here
			</div>
		</div>
	{/if}
</div>

<style>
	.journal-blocks {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		position: relative;
	}

	.file-input-hidden {
		display: none;
	}

	.photo-block-wrap {
		animation: photo-fade-in 250ms ease-out;
	}

	@keyframes photo-fade-in {
		from { opacity: 0; transform: scale(0.97); }
		to { opacity: 1; transform: scale(1); }
	}

	.insert-btn {
		align-self: center;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--ink-faint);
		padding: 0.15rem;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 150ms ease, color 150ms ease, background 150ms ease;
	}

	.journal-blocks:hover .insert-btn {
		opacity: 0.4;
	}

	.insert-btn:hover {
		opacity: 1 !important;
		color: var(--accent);
		background: var(--accent-muted);
	}

	.add-photo-end {
		align-self: flex-start;
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--ink-muted);
		font-family: var(--font-body);
		font-size: 0.75rem;
		padding: 0.35rem 0.7rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.25rem;
		transition: border-color 120ms ease, color 120ms ease;
	}

	.add-photo-end:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Drag-and-drop overlay */
	.journal-blocks.drag-over {
		outline: 2px dashed var(--accent);
		outline-offset: 4px;
		border-radius: var(--radius);
	}

	.drop-overlay {
		position: absolute;
		inset: 0;
		background: rgba(184, 110, 43, 0.06);
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 2;
	}

	.drop-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-body);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent);
		background: var(--surface);
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		box-shadow: 0 2px 8px rgba(61, 43, 31, 0.1);
	}
</style>
