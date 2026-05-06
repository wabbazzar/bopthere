<script lang="ts">
	import { auth, isAuthenticated, isLoading } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { dbGet } from '$lib/stores/db';

	let username = '';
	let password = '';
	let error = '';
	let submitting = false;

	async function getResumePath(): Promise<string> {
		const saved = await dbGet<string>('prefs', 'hw-last-path');
		return saved && saved !== '/' ? saved : '/dashboard';
	}

	$: if (!$isLoading && $isAuthenticated) {
		getResumePath().then((path) => goto(path));
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		error = '';
		submitting = true;

		try {
			await auth.login(username, password);
			const path = await getResumePath();
			goto(path);
		} catch (err: unknown) {
			if (err instanceof Error) {
				const msg = err.message;
				if (msg === 'Failed to fetch' || msg === 'Load failed') {
					error = 'Could not reach the server. Check your connection and try again.';
				} else {
					error = msg || 'Login failed';
				}
			} else {
				error = 'Login failed';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>BopThere</title>
</svelte:head>

{#if $isLoading || $isAuthenticated}
	<!-- Show nothing while checking auth or redirecting to dashboard -->
{:else}
<div class="login-page">
	<div class="login-card">
		<div class="brand">
			<img src="/favicon.png" alt="BopThere mascot" class="mascot" />
			<h1 class="font-display">BopThere</h1>
			<p class="tagline">Your portal to everywhere</p>
		</div>

		<form onsubmit={handleLogin} class="form">
			<div>
				<label for="username" class="field-label">Username</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					placeholder="username"
					required
					disabled={submitting}
					autocomplete="username"
					class="input-themed"
				/>
			</div>

			<div>
				<label for="password" class="field-label">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder="password"
					required
					disabled={submitting}
					autocomplete="current-password"
					class="input-themed"
				/>
			</div>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button type="submit" disabled={submitting} class="btn-primary">
				{submitting ? 'Signing in...' : 'Sign in'}
			</button>
		</form>

		<div class="divider">
			<span>or</span>
		</div>

		<a href="/about" class="about-link">What is BopThere?</a>
	</div>
</div>
{/if}

<style>
	.login-page {
		min-height: 100dvh;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface);
		padding: 1rem;
	}

	.login-card {
		width: 100%;
		max-width: 24rem;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.brand {
		text-align: center;
	}

	.mascot {
		width: 80px;
		height: 80px;
		margin: 0 auto 0.75rem;
		border-radius: 1rem;
	}

	.brand h1 {
		font-size: 1.75rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--ink);
		margin: 0;
	}

	.tagline {
		font-family: var(--font-body);
		font-size: 0.875rem;
		color: var(--ink-muted);
		margin: 0.25rem 0 0;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.field-label {
		display: block;
		font-family: var(--font-body);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ink-muted);
		margin-bottom: 0.375rem;
	}

	.error {
		font-size: 0.8rem;
		color: var(--danger);
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: rgba(196, 64, 64, 0.08);
		border: 1px solid rgba(196, 64, 64, 0.2);
		border-radius: var(--radius);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.divider span {
		font-family: var(--font-body);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.about-link {
		display: block;
		text-align: center;
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--ink-faint);
		text-decoration: none;
		transition: color 150ms ease;
	}

	.about-link:hover {
		color: var(--accent);
	}
</style>
