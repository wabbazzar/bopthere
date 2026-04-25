<script lang="ts">
	import { scriptsStore } from '$lib/stores/scripts';

	export let tripId: string;
	export let dayIndex: number;

	$: dayScripts = ($scriptsStore[tripId] ?? []).filter((s) => s.dayIndex === dayIndex);
</script>

{#if dayScripts.length > 0}
	<div class="script-pills" aria-label="Tour scripts">
		{#each dayScripts as script}
			<a
				href="/trip/{tripId}/script/{script.id}"
				class="script-pill"
				title={script.title}
			>
				{script.title}
			</a>
		{/each}
	</div>
{/if}

<style>
	.script-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.script-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-body);
		font-size: 0.78rem;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		background: var(--accent-muted);
		color: var(--accent);
		text-decoration: none;
		transition: background 150ms ease;
		white-space: nowrap;
	}

	.script-pill:hover {
		background: rgba(184, 110, 43, 0.2);
	}
</style>
