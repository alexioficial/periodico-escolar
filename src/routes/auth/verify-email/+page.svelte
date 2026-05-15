<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	let loading = $state(false);
	let resending = $state(false);
	// svelte-ignore state_referenced_locally
	let email = $state(data.email);
	let code = $state('');
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	async function readError(res: Response, fallback: string) {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function handleVerify(e: SubmitEvent) {
		e.preventDefault();
		if (loading) return;
		loading = true;
		errorMessage = null;
		successMessage = null;
		try {
			const res = await fetch('/api/auth/verify-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, code })
			});
			if (!res.ok) {
				errorMessage = await readError(res, 'No se pudo verificar el código');
				return;
			}
			const body = (await res.json()) as { redirectTo: string };
			await invalidateAll();
			await goto(body.redirectTo);
		} catch {
			errorMessage = 'Error de red';
		} finally {
			loading = false;
		}
	}

	async function handleResend() {
		if (resending || !email) return;
		resending = true;
		errorMessage = null;
		successMessage = null;
		try {
			const res = await fetch('/api/auth/resend-verification', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			if (!res.ok) {
				errorMessage = await readError(res, 'No se pudo reenviar el código');
				return;
			}
			const body = (await res.json()) as { message?: string };
			successMessage = body?.message ?? 'Código reenviado.';
		} catch {
			errorMessage = 'Error de red';
		} finally {
			resending = false;
		}
	}
</script>

<svelte:head>
	<title>Verificar correo · Periódico escolar</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
	<div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Verifica tu correo</h1>
			<p class="text-sm text-slate-600">Ingresa el código de 6 dígitos que te enviamos</p>
		</header>

		{#if errorMessage}
			<div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
				{errorMessage}
			</div>
		{/if}
		{#if successMessage}
			<div
				class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
			>
				{successMessage}
			</div>
		{/if}

		<form class="space-y-4" onsubmit={handleVerify}>
			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="email">Correo</label>
				<input
					id="email"
					name="email"
					type="email"
					bind:value={email}
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>
			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="code">Código</label>
				<input
					id="code"
					name="code"
					value={code}
					oninput={(e) => {
						const v = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
						code = v;
						(e.currentTarget as HTMLInputElement).value = v;
					}}
					inputmode="numeric"
					autocomplete="one-time-code"
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold tracking-widest outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>
			<button
				type="submit"
				class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
				disabled={loading}
			>
				{loading ? 'Verificando...' : 'Verificar'}
			</button>
		</form>

		<button
			type="button"
			onclick={handleResend}
			class="w-full text-xs text-sky-600 hover:underline disabled:opacity-50"
			disabled={resending || loading || !email}
		>
			{resending ? 'Reenviando…' : 'Reenviar código'}
		</button>

		<p class="text-center text-xs text-slate-500">
			¿Ya verificaste?
			<a href="/auth/login" class="text-sky-600 hover:underline">Ir a iniciar sesión</a>
		</p>
	</div>
</div>
