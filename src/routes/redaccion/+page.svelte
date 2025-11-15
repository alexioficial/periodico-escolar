<script lang="ts">
	let { data } = $props();
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<div class="max-w-4xl mx-auto px-4 py-10 space-y-6">
		<div class="flex justify-end">
			<form method="POST" action="/auth/logout">
				<button
					type="submit"
					class="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
				>
					Cerrar sesión
				</button>
			</form>
		</div>
		<header class="space-y-2">
			<p class="text-xs uppercase tracking-[0.25em] text-slate-500">Panel de redacción</p>
			<h1 class="text-3xl font-semibold tracking-tight text-slate-900">Hola, {data.user.email}</h1>
			<p class="text-sm text-slate-600">
				Aquí podrás gestionar artículos, borradores y secciones del periódico escolar.
			</p>
		</header>

		<section class="grid gap-4 sm:grid-cols-2">
			<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<h2 class="text-sm font-semibold text-slate-900">Artículos</h2>
				<p class="mt-1 text-xs text-slate-600">Crea y edita noticias del periódico.</p>
			</div>

			<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<h2 class="text-sm font-semibold text-slate-900">Secciones</h2>
				<p class="mt-1 text-xs text-slate-600">Organiza contenidos por categoría.</p>
			</div>
		</section>
	</div>
</div>
