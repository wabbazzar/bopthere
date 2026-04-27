<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { JournalPhotoBlock as PhotoBlockType } from '$lib/types/trip';
	import { getCachedPhotoUrl, fetchAndCachePhoto } from '$lib/services/photo-cache';

	export let block: PhotoBlockType;
	export let tripId: string = '';

	const dispatch = createEventDispatcher<{
		delete: { blockId: string };
		captionedit: { blockId: string; caption: string };
	}>();

	let resolvedSrc = '';
	let imgError = false;

	$: if (block._localObjectUrl) {
		resolvedSrc = block._localObjectUrl;
		imgError = false;
	} else if (block.photoId.startsWith('http://') || block.photoId.startsWith('https://') || block.photoId.startsWith('blob:')) {
		resolvedSrc = block.photoId;
		imgError = false;
	} else if (block.photoId && tripId) {
		// Server-hosted photo — try local cache first, then fetch
		imgError = false;
		resolvePhoto(block.photoId);
	}

	async function resolvePhoto(filename: string) {
		// 1. Check IndexedDB blob cache (instant, no network)
		const cached = await getCachedPhotoUrl(tripId, filename);
		if (cached) {
			resolvedSrc = cached;
			return;
		}

		// 2. No local cache — get signed URL, fetch blob, cache it
		try {
			const { getPhotoUrl } = await import('$lib/utils/signed-url-cache');
			const signedUrl = await getPhotoUrl(tripId, filename);
			resolvedSrc = await fetchAndCachePhoto(tripId, filename, signedUrl);
		} catch {
			resolvedSrc = '';
		}
	}

	function onImgError() {
		imgError = true;
	}

	$: imgSrc = resolvedSrc;

	function onCaptionInput(e: Event) {
		const el = e.target as HTMLTextAreaElement;
		// Auto-resize: reset to 1 row then expand to content
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}

	function onCaptionBlur(e: FocusEvent) {
		const value = (e.target as HTMLTextAreaElement).value;
		if (value !== block.caption) {
			dispatch('captionedit', { blockId: block.id, caption: value });
		}
	}

	function autosizeCaption(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}

	function onDelete() {
		if (confirm('Remove this photo?')) {
			dispatch('delete', { blockId: block.id });
		}
	}
</script>

<div class="photo-block" class:uploading={block._uploadPending}>
	<div class="photo-img-wrap">
		{#if imgSrc && !imgError}
			<img src={imgSrc} alt={block.caption || 'Journal photo'} loading="lazy" on:error={onImgError} />
		{:else if imgError}
			<div class="photo-error">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
					<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
					<circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
					<path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span>Photo unavailable</span>
			</div>
		{/if}
		{#if block._uploadPending}
			<div class="upload-overlay">
				<div class="upload-spinner"></div>
			</div>
		{/if}
		<button class="photo-delete-btn" on:click={onDelete} aria-label="Remove photo">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
				<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			</svg>
		</button>
	</div>
	<textarea
		class="caption-input"
		value={block.caption}
		on:blur={onCaptionBlur}
		on:input={onCaptionInput}
		use:autosizeCaption
		placeholder="Add caption..."
		rows="1"
	></textarea>
	{#if block.uploadedBy}
		<span class="uploaded-by">by {block.uploadedBy}</span>
	{/if}
</div>

<style>
	.photo-block {
		border-radius: var(--radius);
		overflow: hidden;
		border: 1px solid var(--border);
		background: var(--surface);
	}

	.photo-img-wrap {
		position: relative;
		width: 100%;
		min-height: 80px;
		background: var(--surface-alt);
	}

	.photo-img-wrap img {
		width: 100%;
		display: block;
		object-fit: contain;
		max-height: 400px;
	}

	.photo-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		color: var(--ink-faint);
		font-size: 0.75rem;
	}

	.upload-overlay {
		position: absolute;
		inset: 0;
		background: rgba(61, 43, 31, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.upload-spinner {
		width: 28px;
		height: 28px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.photo-delete-btn {
		position: absolute;
		top: 6px;
		right: 6px;
		background: rgba(61, 43, 31, 0.7);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		color: white;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.photo-block:hover .photo-delete-btn {
		opacity: 1;
	}

	.caption-input {
		width: 100%;
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--ink-muted);
		background: transparent;
		border: none;
		border-top: 1px solid var(--border);
		padding: 0.4rem 0.6rem;
		resize: none;
		overflow: hidden;
		line-height: 1.4;
		box-sizing: border-box;
	}

	.caption-input:focus {
		outline: none;
		color: var(--ink);
		background: var(--surface-alt);
	}

	.uploaded-by {
		display: block;
		font-size: 0.65rem;
		color: var(--ink-faint);
		padding: 0 0.6rem 0.35rem;
	}
</style>
