<script lang="ts">
	let { data } = $props();

	let email = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let sentTo = $state('');
	let errorMessage = $state<string | null>(null);

	async function readError(res: Response, fallback: string) {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (loading) return;
		loading = true;
		errorMessage = null;
		try {
			const qaBypass = data.qaBypassEnabled;
			const res = await fetch(qaBypass ? '/auth/qa-login' : '/api/auth/magic-link', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, returnTo: data.returnTo })
			});
			if (!res.ok) {
				errorMessage = await readError(
					res,
					qaBypass ? 'No se pudo iniciar la sesión QA' : 'No se pudo enviar el enlace'
				);
				return;
			}
			if (qaBypass) {
				const body = (await res.json()) as { redirectTo?: string };
				window.location.assign(body.redirectTo || '/feed');
				return;
			}
			sentTo = email;
			sent = true;
		} catch {
			errorMessage = 'Error de red';
		} finally {
			loading = false;
		}
	}

	function useAnotherEmail() {
		sent = false;
		errorMessage = null;
	}
</script>

<svelte:head>
	<title>Iniciar sesión · Periódico sales</title>
</svelte:head>

<div class="flex min-h-[calc(100svh-9rem)] items-center justify-center text-slate-900">
	<div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
			<p class="text-sm text-slate-600">
				{data.qaBypassEnabled
					? 'Modo QA temporal: inicia sesión directamente con cualquier correo de prueba.'
					: 'Sin contraseñas. Te enviamos un enlace mágico a tu correo y listo.'}
			</p>
		</header>

		{#if !data.qaBypassEnabled}
			<a
				href={`/auth/google?returnTo=${encodeURIComponent(data.returnTo)}`}
				class="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
				<span>Continuar con Google</span>
			</a>

			<div class="flex items-center gap-3 text-xs text-slate-500">
				<div class="h-px flex-1 bg-slate-200"></div>
				<span>o con tu correo</span>
				<div class="h-px flex-1 bg-slate-200"></div>
			</div>
		{/if}

		{#if data.csrfError}
			<div class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
				La sesión OAuth expiró o fue manipulada. Inténtalo de nuevo.
			</div>
		{/if}

		{#if data.linkError}
			<div class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
				{data.linkError}
			</div>
		{/if}

		{#if errorMessage}
			<div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
				{errorMessage}
			</div>
		{/if}

		{#if sent}
			<div
				class="space-y-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-center"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mx-auto h-8 w-8 text-emerald-600"
					aria-hidden="true"
				>
					<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
					<polyline points="22,6 12,13 2,6" />
				</svg>
				<p class="text-sm font-semibold text-emerald-900">Revisá tu correo</p>
				<p class="text-xs text-emerald-800">
					Si <strong class="break-all">{sentTo}</strong> está disponible, te llegará un enlace de acceso.
					Expira en 15 minutos y solo se puede usar una vez.
				</p>
			</div>
			<button
				type="button"
				onclick={useAnotherEmail}
				class="w-full text-center text-xs text-sky-600 hover:underline"
			>
				Usar otro correo
			</button>
		{:else}
			<form class="space-y-4" onsubmit={handleSubmit}>
				<div class="space-y-2">
					<label class="block text-xs font-medium text-slate-700" for="email">
						Correo electrónico
					</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						bind:value={email}
						required
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm ring-0 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
					/>
				</div>

				<button
					type="submit"
					class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
					disabled={loading}
				>
					{loading
						? data.qaBypassEnabled
							? 'Iniciando sesión...'
							: 'Enviando enlace...'
						: data.qaBypassEnabled
							? 'Entrar en modo QA'
							: 'Enviar enlace de acceso'}
				</button>
			</form>
		{/if}
	</div>
</div>
