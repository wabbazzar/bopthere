<script lang="ts">
	import type { JournalBlock, JournalPhotoBlock } from '$lib/types/trip';
	import { journalStore } from '$lib/stores/journal';
	import { uploadPhoto } from '$lib/services/photo-upload';
	import JournalTextBlock from './JournalTextBlock.svelte';
	import JournalPhotoBlockComponent from './JournalPhotoBlock.svelte';

	export let tripId: string;
	export let dayIndex: number;
	export let blocks: JournalBlock[];

	let fileInput: HTMLInputElement;
	let activeTextBlockId: string | null = null;
	let textBlockRefs: Record<string, JournalTextBlock> = {};
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function onTextInput(e: CustomEvent<{ blockId: string; content: string }>) {
		const { blockId, content } = e.detail;
		// Debounce saves at the document level
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			journalStore.updateBlockContent(tripId, dayIndex, blockId, content);
			saveTimer = null;
		}, 2000);
		activeTextBlockId = blockId;
	}

	function onPhotoDelete(e: CustomEvent<{ blockId: string }>) {
		journalStore.removeBlock(tripId, dayIndex, e.detail.blockId);
	}

	function onCaptionEdit(e: CustomEvent<{ blockId: string; caption: string }>) {
		journalStore.updatePhotoCaption(tripId, dayIndex, e.detail.blockId, e.detail.caption);
	}

	function triggerAddPhoto(afterBlockId: string | null) {
		activeTextBlockId = afterBlockId;
		fileInput?.click();
	}

	function onFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Create immediate preview
		const localUrl = URL.createObjectURL(file);
		const photoBlock: JournalPhotoBlock = {
			id: crypto.randomUUID(),
			type: 'photo',
			photoId: '', // Will be set after upload
			caption: '',
			uploadedBy: '',
			_localObjectUrl: localUrl,
			_uploadPending: true
		};

		if (activeTextBlockId) {
			// Try to split at cursor if the active block is a text block
			const ref = textBlockRefs[activeTextBlockId];
			const block = blocks.find((b) => b.id === activeTextBlockId);
			if (ref && block?.type === 'text') {
				const cursorPos = ref.getCursorPosition();
				journalStore.splitAndInsertPhoto(tripId, dayIndex, activeTextBlockId, cursorPos, photoBlock);
			} else {
				journalStore.insertBlock(tripId, dayIndex, activeTextBlockId, photoBlock);
			}
		} else {
			// Append at end
			const lastBlockId = blocks.length > 0 ? blocks[blocks.length - 1].id : null;
			journalStore.insertBlock(tripId, dayIndex, lastBlockId, photoBlock);
		}

		// Upload to server, update block with real photoId on success
		uploadPhoto(tripId, file)
			.then(({ filename }) => {
				journalStore.updatePhotoId(tripId, dayIndex, photoBlock.id, filename);
				URL.revokeObjectURL(localUrl);
			})
			.catch(() => {
				// Upload failed — keep local preview, clear pending state
				// The blob URL remains as the photoId for now
				journalStore.updatePhotoId(tripId, dayIndex, photoBlock.id, localUrl);
			});

		// Reset file input
		input.value = '';
	}

	function registerTextBlockRef(blockId: string, ref: JournalTextBlock) {
		textBlockRefs[blockId] = ref;
	}
</script>

<div class="journal-blocks">
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		capture="environment"
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
				bind:this={textBlockRefs[block.id]}
			/>
		{:else if block.type === 'photo'}
			<JournalPhotoBlockComponent
				{block}
				{tripId}
				on:delete={onPhotoDelete}
				on:captionedit={onCaptionEdit}
			/>
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
</div>

<style>
	.journal-blocks {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.file-input-hidden {
		display: none;
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
		opacity: 0.5;
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
</style>
