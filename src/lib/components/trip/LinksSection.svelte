<script lang="ts">
	import type { Trip } from '$lib/types/trip';
	import { trips } from '$lib/stores/trips';

	export let trip: Trip;
	export let tripId: string;

	let editingLinkIndex: number | null = null;
	let editLinkValue = '';
	let newLinkValue = '';
	let showAddLink = false;

	function startLinkEdit(index: number) { editingLinkIndex = index; editLinkValue = trip.links[index]; }
	function commitLinkEdit() {
		if (editingLinkIndex === null) return;
		trips.updateLink(tripId, editingLinkIndex, editLinkValue);
		editingLinkIndex = null;
	}
	function handleLinkKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); commitLinkEdit(); }
		else if (e.key === 'Escape') { editingLinkIndex = null; }
	}
	function deleteLink(index: number) { trips.deleteLink(tripId, index); }
	function addLink() {
		if (!newLinkValue.trim()) return;
		trips.addLink(tripId, newLinkValue.trim());
		newLinkValue = ''; showAddLink = false;
	}
	function handleNewLinkKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); addLink(); }
		else if (e.key === 'Escape') { showAddLink = false; newLinkValue = ''; }
	}
</script>

<div class="card p-5">
	<div class="flex items-center justify-between mb-3">
		<p class="section-label">Booking Links</p>
		<button on:click={() => (showAddLink = !showAddLink)} class="text-sm" style="color: var(--accent)">
			+ Add
		</button>
	</div>

	{#if showAddLink}
		<div class="mb-3 flex gap-2">
			<input type="text" bind:value={newLinkValue} on:keydown={handleNewLinkKeydown}
				placeholder="https://..." class="input-themed text-sm flex-1" />
			<button on:click={addLink} class="btn-primary text-xs px-3 py-1">Save</button>
			<button on:click={() => { showAddLink = false; newLinkValue = ''; }}
				class="text-xs" style="color: var(--ink-faint)">Cancel</button>
		</div>
	{/if}

	<ul class="space-y-2 text-sm">
		{#each trip.links as link, i}
			<li class="group flex items-start gap-2">
				{#if editingLinkIndex === i}
					<input type="text" bind:value={editLinkValue} on:blur={commitLinkEdit}
						on:keydown={handleLinkKeydown} class="input-themed text-sm flex-1" />
				{:else}
					<a href={link} target="_blank" rel="noopener" class="break-all">
						{link.length > 50 ? link.slice(0, 50) + '...' : link}
					</a>
					<span class="opacity-0 group-hover:opacity-100 flex gap-1 text-xs ml-auto shrink-0" style="color: var(--ink-faint)">
						<button on:click={() => startLinkEdit(i)} style="background:none;border:none;cursor:pointer;color:inherit">edit</button>
						<button on:click={() => deleteLink(i)} style="background:none;border:none;cursor:pointer;color:var(--danger)">{'\u2715'}</button>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
</div>
