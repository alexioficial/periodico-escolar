<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let loading = $state(false);
	// svelte-ignore state_referenced_locally
	let email = $state(data.email);
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

		{#if form?.message && !form?.success}
			<div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
				{form.message}
			</div>
		{/if}
		{#if form?.success}
			<div
				class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
			>
				{form.message}
			</div>
		{/if}

		<form
			class="space-y-4"
			method="POST"
			action="?/verify"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
		>
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
					inputmode="numeric"
					pattern="[0-9]{6}"
					minlength="6"
					maxlength="6"
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold tracking-widest outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>
			<button
				type="submit"
				class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
				disabled={loading}
			>
				Verificar
			</button>
		</form>

		<form method="POST" action="?/resend" use:enhance>
			<input type="hidden" name="email" value={email} />
			<button
				type="submit"
				class="w-full text-xs text-sky-600 hover:underline disabled:opacity-50"
				disabled={loading || !email}
			>
				Reenviar código
			</button>
		</form>

		<p class="text-center text-xs text-slate-500">
			¿Ya verificaste?
			<a href="/auth/login" class="text-sky-600 hover:underline">Ir a iniciar sesión</a>
		</p>
	</div>
</div>
