<script lang="ts">
	import { brandTitle } from '$lib/brand';

	let { data } = $props();
	let email = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let sentTo = $state('');
	let requestError = $state<string | null>(null);

	async function readError(response: Response) {
		try {
			const body = (await response.json()) as { message?: string };
			return body.message || 'No se pudo enviar el enlace';
		} catch {
			return 'No se pudo enviar el enlace';
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (loading) return;
		loading = true;
		requestError = null;
		try {
			const response = await fetch('/api/auth/magic-link', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, returnTo: data.returnTo })
			});
			if (!response.ok) {
				requestError = await readError(response);
				return;
			}
			sentTo = email;
			sent = true;
		} catch {
			requestError = 'Error de red';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>{brandTitle('Iniciar sesión')}</title></svelte:head>

<section class="flex min-h-[calc(100svh-9rem)] items-center justify-center">
	<div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
			<p class="text-sm text-slate-600">
				Usa Google o recibe un enlace de acceso en tu correo. Las cuentas nuevas requieren un correo
				@salesianos.edu.do.
			</p>
		</header>

		<a
			href={`/auth/google?returnTo=${encodeURIComponent(data.returnTo)}`}
			class="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					fill="#4285F4"
				/>
				<path
					d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					fill="#34A853"
				/>
				<path
					d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					fill="#FBBC05"
				/>
				<path
					d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
					fill="#EA4335"
				/>
			</svg>
			Continuar con Google
		</a>

		<div class="flex items-center gap-3 text-xs text-slate-500">
			<div class="h-px flex-1 bg-slate-200"></div>
			<span>o con tu correo</span>
			<div class="h-px flex-1 bg-slate-200"></div>
		</div>

		{#if data.errorMessage || requestError}
			<div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
				{requestError || data.errorMessage}
			</div>
		{/if}

		{#if sent}
			<div class="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center">
				<p class="text-sm font-semibold text-emerald-900">Revisa tu correo</p>
				<p class="text-xs text-emerald-800">
					Enviamos un enlace a <strong class="break-all">{sentTo}</strong>. Expira en 15 minutos y
					solo puede usarse una vez.
				</p>
			</div>
			<button
				type="button"
				onclick={() => (sent = false)}
				class="w-full text-xs text-sky-700 hover:underline">Usar otro correo</button
			>
		{:else}
			<form class="space-y-4" onsubmit={submit}>
				<label class="block space-y-2 text-xs font-medium text-slate-700" for="email">
					Correo electrónico
					<input
						id="email"
						type="email"
						autocomplete="email"
						bind:value={email}
						required
						class="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
					/>
				</label>
				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
				>
					{loading ? 'Enviando enlace…' : 'Enviar enlace de acceso'}
				</button>
			</form>
		{/if}
	</div>
</section>
