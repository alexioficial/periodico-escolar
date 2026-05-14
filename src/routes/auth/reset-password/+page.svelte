<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let loading = $state(false);
	// svelte-ignore state_referenced_locally
	let email = $state(data.email);
</script>

<svelte:head>
	<title>Restablecer contraseña · Periódico escolar</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
	<div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Crea una contraseña nueva</h1>
			<p class="text-sm text-slate-600">
				Ingresa el código que te enviamos y elige una contraseña nueva.
			</p>
		</header>

		{#if form?.message}
			<div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
				{form.message}
			</div>
		{/if}

		<form
			class="space-y-4"
			method="POST"
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
			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="password">
					Nueva contraseña
				</label>
				<input
					id="password"
					name="password"
					type="password"
					minlength="6"
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>
			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="confirmPassword">
					Confirma la contraseña
				</label>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					minlength="6"
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>
			<button
				type="submit"
				class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
				disabled={loading}
			>
				{loading ? 'Guardando...' : 'Guardar nueva contraseña'}
			</button>
		</form>

		<p class="text-center text-xs text-slate-500">
			¿No te llegó? <a href="/auth/forgot-password" class="text-sky-600 hover:underline">
				Solicitar otro código
			</a>
		</p>
	</div>
</div>
