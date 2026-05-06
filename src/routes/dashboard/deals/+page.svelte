<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchDeals, getAlertSettings, updateAlertSettings } from '$lib/services/deals';
	import type { Deal, AlertSettings } from '$lib/services/deals';

	let deals: Deal[] = [];
	let alerts: AlertSettings = { enabled: false, signal_number: '', home_airport: 'AUS' };
	let loading = true;
	let saving = false;
	let error = '';

	onMount(async () => {
		try {
			const [d, a] = await Promise.all([fetchDeals(), getAlertSettings()]);
			deals = d;
			alerts = a;
		} catch (e) {
			error = 'Failed to load deals';
		} finally {
			loading = false;
		}
	});

	async function saveAlerts() {
		saving = true;
		try {
			await updateAlertSettings(alerts);
		} catch {
			error = 'Failed to save settings';
		} finally {
			saving = false;
		}
	}

	function formatDate(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function reactionBadge(reaction: string | null): string {
		if (!reaction) return '';
		if (reaction === 'like' || reaction === 'love') return 'Liked';
		if (reaction === 'dislike') return 'Passed';
		return reaction;
	}
</script>

<svelte:head>
	<title>Deals - BopThere</title>
</svelte:head>

{#if loading}
	<p class="text-sm" style="color: var(--ink-faint)">Loading deals...</p>
{:else}

<div class="max-w-2xl">
	<p class="section-label mb-4">Deal Alerts</p>

	<div class="card p-5 mb-8">
		<div class="flex items-center gap-3 mb-4">
			<label class="toggle">
				<input type="checkbox" bind:checked={alerts.enabled} on:change={saveAlerts} />
				<span class="toggle-track"></span>
			</label>
			<span class="text-sm" style="color: var(--ink)">
				{alerts.enabled ? 'Daily deals enabled' : 'Daily deals disabled'}
			</span>
		</div>

		{#if alerts.enabled}
			<div class="grid gap-3" style="grid-template-columns: 1fr 1fr">
				<div>
					<label for="home-airport" class="field-label">Home Airport</label>
					<input
						id="home-airport"
						type="text"
						bind:value={alerts.home_airport}
						on:blur={saveAlerts}
						placeholder="AUS"
						maxlength="4"
						class="input-themed"
						style="text-transform: uppercase"
					/>
				</div>
				<div>
					<label for="signal-number" class="field-label">Signal Number</label>
					<input
						id="signal-number"
						type="tel"
						bind:value={alerts.signal_number}
						on:blur={saveAlerts}
						placeholder="+1234567890"
						class="input-themed"
					/>
				</div>
			</div>
			<p class="text-xs mt-2" style="color: var(--ink-faint)">
				Deals sent daily at 6:30am CT via Signal.
			</p>
		{/if}
	</div>

	{#if error}
		<p class="text-sm mb-4" style="color: var(--danger)">{error}</p>
	{/if}

	<p class="section-label mb-4">Recent Deals</p>

	{#if deals.length === 0}
		<p class="text-sm" style="color: var(--ink-faint)">No deals yet. Enable alerts to start receiving daily flight deals.</p>
	{:else}
		<div class="grid gap-3">
			{#each deals as deal}
				<div class="card p-4">
					<div class="flex items-start justify-between">
						<div>
							<h3 class="font-display text-lg font-semibold" style="color: var(--ink)">
								{deal.destination}
							</h3>
							<p class="text-sm" style="color: var(--ink-muted)">
								{deal.country} &middot; {formatDate(deal.depart_date)}
							</p>
						</div>
						<div class="text-right shrink-0 ml-4">
							<span class="font-display text-xl font-semibold" style="color: var(--accent)">
								${Math.round(deal.total_cost)}
							</span>
							<span class="block text-xs" style="color: var(--ink-faint)">for 2</span>
						</div>
					</div>

					{#if deal.reaction}
						<div class="mt-2">
							<span class="badge" style="background: var(--accent-muted); color: var(--accent)">
								{reactionBadge(deal.reaction)}
							</span>
						</div>
					{/if}

					<details class="mt-3">
						<summary class="text-xs cursor-pointer" style="color: var(--ink-faint)">Full details</summary>
						<pre class="text-xs mt-2 whitespace-pre-wrap" style="color: var(--ink-muted); font-family: var(--font-body)">{deal.summary}</pre>
					</details>
				</div>
			{/each}
		</div>
	{/if}
</div>

{/if}

<style>
	.field-label {
		display: block;
		font-family: var(--font-body);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ink-muted);
		margin-bottom: 0.375rem;
	}

	.toggle {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
		cursor: pointer;
	}

	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-track {
		position: absolute;
		inset: 0;
		background: var(--border);
		border-radius: 999px;
		transition: background 200ms ease;
	}

	.toggle-track::before {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		background: white;
		border-radius: 50%;
		transition: transform 200ms ease;
	}

	.toggle input:checked + .toggle-track {
		background: var(--accent);
	}

	.toggle input:checked + .toggle-track::before {
		transform: translateX(20px);
	}
</style>
