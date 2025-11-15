<script lang="ts">
	let {} = $props();
</script>

<section class="space-y-8">
	<header class="space-y-3">
		<p class="text-xs uppercase tracking-[0.25em] text-slate-500">Periódico escolar</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
			Tu periódico escolar, en un solo lugar
		</h1>
		<p class="max-w-2xl text-sm text-slate-600">
			Explora noticias, proyectos y actividades de tu comunidad educativa. Muy pronto verás aquí las
			últimas novedades publicadas por el equipo de redacción.
		</p>
	</header>

	<section class="grid gap-4 md:grid-cols-3">
		<div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Noticias</p>
			<p class="mt-2 font-medium text-slate-900">Artículos del colegio</p>
			<p class="mt-1 text-xs text-slate-600">
				Publicaciones sobre actividades, logros, proyectos y avisos importantes.
			</p>
		</div>

		<div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Eventos</p>
			<p class="mt-2 font-medium text-slate-900">Calendario escolar</p>
			<p class="mt-1 text-xs text-slate-600">
				Espacio para destacar ferias, campeonatos, exposiciones y otras actividades.
			</p>
		</div>

		<div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Comunidad</p>
			<p class="mt-2 font-medium text-slate-900">Clubes y grupos</p>
			<p class="mt-1 text-xs text-slate-600">
				Un lugar para visibilizar clubes, iniciativas estudiantiles y proyectos colaborativos.
			</p>
		</div>
	</section>

	<section
		class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-700"
	>
		<p class="font-medium text-slate-900">Próximamente</p>
		<p class="mt-1 text-xs text-slate-600">
			Aquí verás un listado de artículos con filtros por sección, buscador y etiquetas, pensado para ser
			simple y fácil de usar, como las aplicaciones de Google.
		</p>
	</section>
</section>
