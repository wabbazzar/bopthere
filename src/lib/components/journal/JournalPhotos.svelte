<script lang="ts">
	import type { JournalPhoto } from '$lib/types/trip';
	import { journalStore } from '$lib/stores/journal';

	export let tripId: string;
	export let dayIndex: number;
	export let photos: JournalPhoto[];

	let urlInput = '';
	let captionInput = '';
	let showAddForm = false;

	function addPhoto() {
		const url = urlInput.trim();
		if (!url) return;
		const photo: JournalPhoto = {
			id: crypto.randomUUID(),
			url,
			caption: captionInput.trim()
		};
		journalStore.addPhoto(tripId, dayIndex, photo);
		urlInput = '';
		captionInput = '';
		showAddForm = false;
	}

	function removePhoto(photoId: string) {
		if (confirm('Remove this photo?')) {
			journalStore.removePhoto(tripId, dayIndex, photoId);
		}
	}

	function updateCaption(photoId: string, caption: string) {
		journalStore.updatePhotoCaption(tripId, dayIndex, photoId, caption);
	}

	function handleUrlKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addPhoto();
		} else if (e.key === 'Escape') {
			showAddForm = false;
			urlInput = '';
			captionInput = '';
		}
	}
</script>

<section class="photos-section">
	<div class="photos-header">
		<h3 class="section-label">
			Photos
			{#if photos.length > 0}
				<span class="photo-count">{photos.length}</span>
			{/if}
		</h3>
		{#if !showAddForm}
			<button class="add-photo-btn" on:click={() => (showAddForm = true)}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
					<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				</svg>
				Add
			</button>
		{/if}
	</div>

	{#if showAddForm}
		<div class="add-form">
			<input
				type="url"
				class="url-input"
				bind:value={urlInput}
				on:keydown={handleUrlKeydown}
				placeholder="Paste image URL..."
			/>
			<input
				type="text"
				class="caption-form-input"
				bind:value={captionInput}
				on:keydown={handleUrlKeydown}
				placeholder="Caption (optional)"
			/>
			<div class="form-actions">
				<button class="btn-ghost" on:click={() => { showAddForm = false; urlInput = ''; captionInput = ''; }}>
					Cancel
				</button>
				<button class="btn-primary" on:click={addPhoto} disabled={!urlInput.trim()}>
					Add Photo
				</button>
			</div>
		</div>
	{/if}

	{#if photos.length > 0}
		<div class="photo-grid">
			{#each photos as photo (photo.id)}
				<div class="photo-card">
					<div class="photo-img-wrap">
						<img src={photo.url} alt={photo.caption || 'Photo'} loading="lazy" />
						<button
							class="photo-delete"
							on:click={() => removePhoto(photo.id)}
							aria-label="Remove photo"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
								<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
							</svg>
						</button>
					</div>
					<input
						type="text"
						class="caption-input"
						value={photo.caption}
						on:blur={(e) => updateCaption(photo.id, e.currentTarget.value)}
						placeholder="Add caption..."
					/>
				</div>
			{/each}
		</div>
	{:else if !showAddForm}
		<p class="empty-state">No photos yet</p>
	{/if}
</section>

<style>
	.photos-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.photos-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.photo-count {
		background: var(--accent-muted);
		color: var(--accent);
		font-size: 0.65rem;
		padding: 0.1rem 0.35rem;
		border-radius: 8px;
		font-weight: 700;
	}

	.add-photo-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--ink-muted);
		font-family: var(--font-body);
		font-size: 0.75rem;
		padding: 0.3rem 0.6rem;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		transition: border-color 120ms ease, color 120ms ease;
	}

	.add-photo-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem;
		background: var(--surface-alt);
		border-radius: var(--radius);
		border: 1px solid var(--border);
	}

	.url-input,
	.caption-form-input {
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--ink);
	}

	.url-input:focus,
	.caption-form-input:focus {
		outline: 2px solid var(--accent);
		outline-offset: -1px;
	}

	.form-actions {
		display: flex;
		gap: 0.4rem;
		justify-content: flex-end;
	}

	.btn-ghost {
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--ink-muted);
		font-family: var(--font-body);
		font-size: 0.8rem;
		padding: 0.4rem 0.75rem;
	}

	.btn-primary {
		background: var(--accent);
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		color: white;
		font-family: var(--font-body);
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.4rem 0.75rem;
		transition: background 120ms ease;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.photo-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	@media (min-width: 480px) {
		.photo-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.photo-card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface);
	}

	.photo-img-wrap {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		background: var(--surface-alt);
	}

	.photo-img-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.photo-delete {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(61, 43, 31, 0.7);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		color: white;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.photo-card:hover .photo-delete {
		opacity: 1;
	}

	.caption-input {
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: var(--ink-muted);
		background: transparent;
		border: none;
		border-top: 1px solid var(--border);
		padding: 0.35rem 0.5rem;
	}

	.caption-input:focus {
		outline: none;
		color: var(--ink);
		background: var(--surface-alt);
	}

	.empty-state {
		font-size: 0.8rem;
		color: var(--ink-faint);
		font-style: italic;
		margin: 0;
		padding: 0.75rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		text-align: center;
	}
</style>
