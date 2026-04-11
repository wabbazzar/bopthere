<script lang="ts">
	import '../app.css';
	import { auth, isAuthenticated, isLoading, user } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ChatFab from '$lib/components/chat/ChatFab.svelte';
	import ChatDrawer from '$lib/components/chat/ChatDrawer.svelte';

	onMount(() => {
		auth.init();
	});

	function handleLogout() {
		auth.logout();
		goto('/');
	}

	$: if (!$isLoading && !$isAuthenticated && $page.url.pathname !== '/') {
		goto('/');
	}
</script>

{#if $isLoading}
	<div class="min-h-screen flex items-center justify-center" style="background: var(--surface)">
		<p class="font-display text-ink-muted tracking-widest text-sm uppercase">Loading...</p>
	</div>
{:else if $isAuthenticated}
	<div class="min-h-screen flex flex-col">
		<header
			class="px-5 py-3 flex items-center justify-between"
			style="background: var(--surface-alt); border-bottom: 1px solid var(--border)"
		>
			<nav class="flex gap-5 items-center">
				<a href="/dashboard" class="font-display text-lg tracking-wide no-underline" style="color: var(--ink)">
					H&W
				</a>
				<a href="/dashboard" class="text-sm no-underline" style="color: var(--ink-muted)">Trips</a>
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
	<ChatFab />
	<ChatDrawer />
{:else}
	<slot />
{/if}
