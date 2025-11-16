<script lang="ts">
	let email = '';
	let code = '';
	let loading = false;
	let error: string | null = null;
	let success: string | null = null;

	const submit = async (e: SubmitEvent) => {
		loading = true;
		error = null;
		success = null;
		const form = e.target as HTMLFormElement;
		const res = await fetch('/auth/verify-email', { method: 'POST', body: new FormData(form) });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			error = data?.message ?? 'Error al verificar';
		} else {
			success = 'Correo verificado correctamente. Ya puedes iniciar sesión.';
		}
		loading = false;
	};

	const resend = async () => {
		loading = true;
		error = null;
		success = null;
		const res = await fetch('/auth/verify-email/resend', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email })
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			error = data?.message ?? 'No se pudo reenviar el código';
		} else {
			success = 'Código reenviado. Revisa tu correo.';
		}
		loading = false;
	};
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
	<div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
		<header class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Verifica tu correo</h1>
			<p class="text-sm text-slate-600">Ingresa el código de 6 dígitos que te enviamos</p>
		</header>

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

		<form class="space-y-4" method="POST" on:submit|preventDefault={submit}>
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
					bind:value={code}
					required
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold tracking-widest outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
				/>
			</div>
			<button
				type="submit"
				class="w-full rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
				disabled={loading}>Verificar</button
			>
		</form>

		<button
			type="button"
			on:click={resend}
			class="w-full text-xs text-sky-600 hover:underline"
			disabled={loading || !email}
		>
			Reenviar código
		</button>

		<p class="text-center text-xs text-slate-500">
			¿Ya verificaste?
			<a href="/auth/login" class="text-sky-600 hover:underline">Ir a iniciar sesión</a>
		</p>
	</div>
</div>
