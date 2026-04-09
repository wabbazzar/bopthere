<script lang="ts">
	import { auth, isAuthenticated, isLoading } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let username = '';
	let password = '';
	let error = '';
	let submitting = false;

	$: if (!$isLoading && $isAuthenticated) {
		goto('/dashboard');
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		error = '';
		submitting = true;

		try {
			await auth.login(username, password);
			goto('/dashboard');
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Login failed';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>H&W Travel</title>
</svelte:head>

{#if $isLoading || $isAuthenticated}
	<!-- Show nothing while checking auth or redirecting to dashboard -->
{:else}
<div class="min-h-screen flex items-center justify-center relative overflow-hidden">
	<!-- Background art -->
	<div
		class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
		style="background-image: url('/app-uploads/web_entry_background.png')"
	></div>

	<div class="relative z-10 w-full max-w-sm p-8">
		<div class="card p-8">
			<h1 class="font-display text-3xl font-semibold mb-1 text-center tracking-wide">
				H&W Travel
			</h1>
			<p class="text-center text-ink-muted text-sm mb-8">Your portal to everywhere</p>

			<form onsubmit={handleLogin} class="flex flex-col gap-5">
				<div>
					<label for="username" class="section-label block mb-1.5">Username</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						required
						autocomplete="username"
						class="input-themed"
					/>
				</div>

				<div>
					<label for="password" class="section-label block mb-1.5">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						autocomplete="current-password"
						class="input-themed"
					/>
				</div>

				{#if error}
					<p class="text-sm" style="color: var(--danger)">{error}</p>
				{/if}

				<button type="submit" disabled={submitting} class="btn-primary">
					{submitting ? 'Signing in...' : 'Sign in'}
				</button>
			</form>
		</div>
	</div>
</div>
{/if}
