<script lang="ts">
	import '../app.css';
	import { auth, isAuthenticated, isLoading, user } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { chat } from '$lib/stores/chat';
	import { migrateLocalStorageToIndexedDB } from '$lib/stores/db-migration';
	import { dbPut } from '$lib/stores/db';
	import ChatFab from '$lib/components/chat/ChatFab.svelte';
	import ChatDrawer from '$lib/components/chat/ChatDrawer.svelte';

	onMount(async () => {
		// Run one-time migration FIRST (no-op if already done)
		await migrateLocalStorageToIndexedDB();
		// Then init auth from IndexedDB
		await auth.init();
	});

	async function handleLogout() {
		await auth.logout();
		goto('/');
	}

	// Persist current path for authenticated users (skip login page)
	$: if ($isAuthenticated && $page.url.pathname !== '/') {
		dbPut('prefs', 'hw-last-path', $page.url.pathname);
	}

	$: if (!$isLoading && !$isAuthenticated && $page.url.pathname !== '/' && $page.url.pathname !== '/about') {
		goto('/');
	}
</script>

{#if $isLoading}
	<div class="min-h-screen flex items-center justify-center" style="background: var(--surface)">
		<p class="font-display text-ink-muted tracking-widest text-sm uppercase">Loading...</p>
	</div>
{:else if $isAuthenticated}
	<div class="app-shell" class:chat-open={$chat.isOpen}>
		<div class="app-main">
			<header
				class="px-5 py-3 flex items-center justify-between"
				style="background: var(--surface-alt); border-bottom: 1px solid var(--border)"
			>
				<nav class="flex gap-5 items-center">
					<a href="/dashboard" class="font-display text-lg tracking-wide no-underline" style="color: var(--ink)">
						BopThere
					</a>
					<a href="/dashboard" class="text-sm no-underline" style="color: var(--ink-muted)">Trips</a>
					<a href="/dashboard/deals" class="text-sm no-underline" style="color: var(--ink-muted)">Deals</a>
				</nav>
				<div class="flex gap-4 items-center">
					<span class="text-sm" style="color: var(--ink-muted)">
						{$user?.full_name || $user?.username}
					</span>
					<button
						onclick={handleLogout}
						class="text-sm"
						style="color: var(--ink-faint); text-decoration: none; cursor: pointer; background: none; border: none; font-family: var(--font-body)"
					>
						Logout
					</button>
				</div>
			</header>
			<main class="flex-1 p-5 md:p-8 max-w-6xl mx-auto w-full">
				<slot />
			</main>
		</div>
		<ChatDrawer />
	</div>
	<ChatFab />
{:else}
	<slot />
{/if}

<style>
	.app-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.app-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	@media (min-width: 1024px) {
		.app-main {
			transition: margin-right 300ms cubic-bezier(0.16, 1, 0.3, 1);
		}

		.chat-open .app-main {
			margin-right: 420px;
		}
	}
</style>
