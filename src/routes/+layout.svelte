<script lang="ts">
	import '../app.css';
	import { auth, isAuthenticated, isLoading, user } from '$lib/stores/auth';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { chat } from '$lib/stores/chat';
	import { migrateLocalStorageToIndexedDB } from '$lib/stores/db-migration';
	import { dbPut } from '$lib/stores/db';
	import ChatFab from '$lib/components/chat/ChatFab.svelte';
	import ChatDrawer from '$lib/components/chat/ChatDrawer.svelte';

	let menuOpen = false;
	let shareCopied = false;
	let shareCopiedTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		await migrateLocalStorageToIndexedDB();
		await auth.init();
	});

	onDestroy(() => {
		if (shareCopiedTimer) clearTimeout(shareCopiedTimer);
	});

	async function handleLogout() {
		menuOpen = false;
		await auth.logout();
		goto('/');
	}

	async function shareApp() {
		const url = 'https://bopthere.com';
		const title = 'BopThere';
		if (typeof navigator !== 'undefined' && 'share' in navigator) {
			try {
				await navigator.share({ title, url });
				menuOpen = false;
				return;
			} catch {
				// user cancelled or share failed — fall through to copy
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			shareCopied = true;
			if (shareCopiedTimer) clearTimeout(shareCopiedTimer);
			shareCopiedTimer = setTimeout(() => { shareCopied = false; }, 2000);
		} catch {
			window.prompt('Copy this link:', url);
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.header-menu')) {
			menuOpen = false;
		}
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
				<div class="header-menu" style="position: relative">
					<button
						class="menu-trigger"
						onclick={() => menuOpen = !menuOpen}
						aria-label="Menu"
						aria-expanded={menuOpen}
					>
						<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
							<path d="M4 6h16M4 12h16M4 18h16"/>
						</svg>
					</button>

					{#if menuOpen}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<div class="menu-backdrop" onclick={() => menuOpen = false}></div>
						<div class="menu-dropdown" role="menu">
							<div class="menu-user">
								<span class="menu-user-name">{$user?.full_name || $user?.username}</span>
							</div>

							<div class="menu-divider"></div>

							<button class="menu-item" role="menuitem" onclick={shareApp}>
								<div class="menu-icon share-icon">
									<img src="/share-icon-64.png" alt="" width="20" height="20" />
								</div>
								<div>
									<div class="menu-item-label">Share app</div>
									<div class="menu-item-sub">
										{shareCopied ? 'Link copied!' : 'Send bopthere.com to a friend'}
									</div>
								</div>
							</button>

							<div class="menu-divider"></div>

							<button class="menu-item" role="menuitem" onclick={handleLogout}>
								<div class="menu-icon logout-icon">
									<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
										<path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
									</svg>
								</div>
								<div>
									<div class="menu-item-label">Log out</div>
								</div>
							</button>
						</div>
					{/if}
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

	/* ── Hamburger menu ── */
	.menu-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: none;
		background: none;
		color: var(--ink-muted);
		cursor: pointer;
		border-radius: var(--radius);
		transition: background 150ms ease, color 150ms ease;
	}
	.menu-trigger:hover {
		background: var(--accent-muted);
		color: var(--ink);
	}

	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
	}

	.menu-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 220px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		z-index: 91;
		overflow: hidden;
	}

	.menu-user {
		padding: 0.75rem 1rem;
	}
	.menu-user-name {
		font-family: var(--font-display);
		font-size: 0.8rem;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.menu-divider {
		height: 1px;
		background: var(--border);
		margin: 0 0.75rem;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		font-family: var(--font-body);
		transition: background 150ms ease;
		min-height: 44px;
	}
	.menu-item:hover {
		background: var(--accent-muted);
	}

	.menu-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.share-icon {
		background: var(--accent-muted);
		overflow: hidden;
	}
	.share-icon img {
		width: 20px;
		height: 20px;
		border-radius: 4px;
	}
	.logout-icon {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.menu-item-label {
		font-size: 0.85rem;
		color: var(--ink);
		font-weight: 500;
	}
	.menu-item-sub {
		font-size: 0.7rem;
		color: var(--ink-faint);
		margin-top: 1px;
	}
</style>
