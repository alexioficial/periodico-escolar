<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();

	let loading = $state(false);
	// svelte-ignore state_referenced_locally
	let email = $state(data.email);
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
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			if (!res.ok) {
				errorMessage = await readError(res, 'No se pudo enviar el código');
				return;
			}
			const body = (await res.json()) as { redirectTo: string };
			await goto(body.redirectTo);
		} catch {
			errorMessage = 'Error de red';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Recuperar contraseña · Periódico escolar</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
	<div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Restablece tu contraseña</h1>
			<p class="text-sm text-slate-600">
				Te enviaremos un código de 6 dígitos al correo para que crees una contraseña nueva.
			</p>
		</header>

		{#if errorMessage}
			<div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
				{errorMessage}
			</div>
		{/if}

		<form class="space-y-4" onsubmit={handleSubmit}>
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
			<button
				type="submit"
				class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
				disabled={loading}
			>
				{loading ? 'Enviando...' : 'Enviar código'}
			</button>
		</form>

		<p class="text-center text-xs text-slate-500">
			<a href="/auth/login" class="text-sky-600 hover:underline">Volver al inicio de sesión</a>
		</p>
	</div>
</div>
