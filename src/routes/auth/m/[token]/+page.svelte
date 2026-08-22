<svelte:head>
	<title>Confirmar acceso · Periódico sales</title>
</svelte:head>

<section class="mx-auto flex min-h-[60vh] max-w-md items-center">
	<div class="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Acceso seguro</p>
		<h1 class="mt-3 text-2xl font-semibold text-slate-900">Confirmar inicio de sesión</h1>
		<p class="mt-3 text-sm text-slate-600">
			Presiona continuar para usar el enlace que recibiste por correo.
		</p>
		<form method="POST" class="mt-6">
			<button
				type="submit"
				class="w-full rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
			>
				Continuar
			</button>
		</form>
	</div>
</section>
