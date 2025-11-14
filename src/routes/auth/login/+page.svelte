<script lang="ts">
	let email = '';
	let password = '';
	let error: string | null = null;
	let loading = false;

	const handleSubmit = async (event: SubmitEvent) => {
		loading = true;
		error = null;

		const form = event.target as HTMLFormElement;
		const res = await fetch('/auth/login', {
			method: 'POST',
			body: new FormData(form)
		});

		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			error = data?.message ?? 'Error al iniciar sesión';
		} else if (data?.redirectTo) {
			window.location.href = data.redirectTo;
		}

		loading = false;
	};
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
	<div class="w-full max-w-md space-y-6 p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
			<p class="text-sm text-slate-400">Accede al periódico escolar con tu cuenta</p>
		</header>

		<button
			type="button"
			class="w-full flex items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
			disabled
		>
			<span class="i-[mdi--google] h-4 w-4"></span>
			<span>Continuar con Google (próximamente)</span>
		</button>

		<div class="flex items-center gap-3 text-xs text-slate-500">
			<div class="h-px flex-1 bg-slate-800"></div>
			<span>o con tu correo</span>
			<div class="h-px flex-1 bg-slate-800"></div>
		</div>

		{#if error}
			<div class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
				{error}
			</div>
		{/if}

		<form class="space-y-4" method="POST" on:submit|preventDefault={handleSubmit}>
			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-300" for="email">Correo electrónico</label>
				<input
					id="email"
					name="email"
					type="email"
					bind:value={email}
					required
					class="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
				/>
			</div>

			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-300" for="password">Contraseña</label>
				<input
					id="password"
					name="password"
					type="password"
					bind:value={password}
					minlength="6"
					required
					class="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 hover:bg-sky-400 transition-colors disabled:opacity-60"
				disabled={loading}
			>
				{#if loading}
					Iniciando sesión...
				{:else}
					Entrar
				{/if}
			</button>
		</form>

		<p class="text-xs text-center text-slate-500">
			¿No tienes cuenta?
			<a href="/auth/register" class="text-sky-400 hover:underline">Regístrate</a>
		</p>
	</div>
</div>
