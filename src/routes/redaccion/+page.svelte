<script lang="ts">
	let { data } = $props();
</script>

<div class="min-h-screen bg-slate-950 text-slate-50">
	<div class="max-w-4xl mx-auto px-4 py-10 space-y-6">
		<div class="flex justify-end">
			<form method="POST" action="/auth/logout">
				<button
					type="submit"
					class="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
				>
					Cerrar sesión
				</button>
			</form>
		</div>
		<header class="space-y-2">
			<p class="text-xs uppercase tracking-[0.25em] text-slate-500">Panel de redacción</p>
			<h1 class="text-3xl font-semibold tracking-tight">Hola, {data.user.email}</h1>
			<p class="text-sm text-slate-400">
				Aquí podrás gestionar artículos, borradores y secciones del periódico escolar.
			</p>
		</header>

		<section class="grid gap-4 sm:grid-cols-2">
			<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
				<h2 class="text-sm font-semibold text-slate-100">Artículos</h2>
				<p class="mt-1 text-xs text-slate-400">Crea y edita noticias del periódico.</p>
			</div>

			<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
				<h2 class="text-sm font-semibold text-slate-100">Secciones</h2>
				<p class="mt-1 text-xs text-slate-400">Organiza contenidos por categoría.</p>
			</div>
		</section>
	</div>
</div>
