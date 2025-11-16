<script lang="ts">
	let email = '';
	let username = '';
	let password = '';
	let confirmPassword = '';
	let error: string | null = null;
	let success: string | null = null;
	let loading = false;

	const handleSubmit = async (event: SubmitEvent) => {
		loading = true;
		error = null;
		success = null;

		if (password !== confirmPassword) {
			loading = false;
			error = 'Las contraseñas no coinciden';
			return;
		}

		const form = event.target as HTMLFormElement;
		const res = await fetch('/auth/register', {
			method: 'POST',
			body: new FormData(form)
		});

		const data = await res.json().catch(() => ({}));

		if (!res.ok) {
			error = data?.message ?? 'Error al registrarse';
		} else {
			success = 'Cuenta creada. Revisa tu correo y verifica con el código de 6 dígitos.';
			password = '';
			confirmPassword = '';
		}

		loading = false;
	};
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
	<div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Crea tu cuenta</h1>
			<p class="text-sm text-slate-600">Regístrate para colaborar en el periódico escolar</p>
		</header>

		<a
			href="/auth/google"
			class="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
		>
			<span class="i-[mdi--google] h-4 w-4"></span>
			<span>Continuar con Google</span>
		</a>

		<div class="flex items-center gap-3 text-xs text-slate-500">
			<div class="h-px flex-1 bg-slate-200"></div>
			<span>o con tu correo</span>
			<div class="h-px flex-1 bg-slate-200"></div>
		</div>

		{#if error}
			<div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
				{error}
			</div>
		{/if}

		{#if success}
			<div
				class="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
			>
				{success}
			</div>
		{/if}

		<form class="space-y-4" method="POST" on:submit|preventDefault={handleSubmit}>
			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="username"
					>Nombre de usuario</label
				>
				<input
					id="username"
					name="username"
					type="text"
					bind:value={username}
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm ring-0 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>
			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="email"
					>Correo electrónico</label
				>
				<input
					id="email"
					name="email"
					type="email"
					bind:value={email}
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm ring-0 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>

			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="password">Contraseña</label>
				<input
					id="password"
					name="password"
					type="password"
					bind:value={password}
					minlength="6"
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm ring-0 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>

			<div class="space-y-2">
				<label class="block text-xs font-medium text-slate-700" for="confirmPassword"
					>Repite la contraseña</label
				>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					bind:value={confirmPassword}
					minlength="6"
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm ring-0 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
				disabled={loading}
			>
				{#if loading}
					Creando cuenta...
				{:else}
					Registrarse
				{/if}
			</button>
		</form>

		<p class="text-center text-xs text-slate-500">
			¿Ya tienes cuenta?
			<a href="/auth/login" class="text-sky-600 hover:underline">Inicia sesión</a>
		</p>
	</div>
</div>
