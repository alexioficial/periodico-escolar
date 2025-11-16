<script lang="ts">
	let { data } = $props();
</script>

<section class="space-y-8">
	<header class="space-y-3">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Panel de redacción</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
			Hola, {data.user.email}
		</h1>
		<p class="max-w-2xl text-sm text-slate-600">
			Gestiona los contenidos del periódico escolar: artículos, secciones y borradores, con una
			vista clara y sencilla.
		</p>
	</header>

	<section class="grid gap-4 md:grid-cols-3">
		<div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
			<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Artículos</p>
			<p class="mt-2 font-medium text-slate-900">Redacción y publicación</p>
			<p class="mt-1 text-xs text-slate-600">
				Crea nuevas noticias, edita contenido existente y controla qué se publica en el feed.
			</p>
		</div>

		<div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
			<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Secciones</p>
			<p class="mt-2 font-medium text-slate-900">Organización del contenido</p>
			<p class="mt-1 text-xs text-slate-600">
				Define categorías como deportes, cultura o ciencia para agrupar los artículos.
			</p>
		</div>

		<div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
			<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Borradores</p>
			<p class="mt-2 font-medium text-slate-900">Trabajo en progreso</p>
			<p class="mt-1 text-xs text-slate-600">
				Prepara artículos con calma, guárdalos como borrador y publícalos cuando estén listos.
			</p>
		</div>
	</section>

	<section
		class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-700"
	>
		<p class="font-medium text-slate-900">Próximamente</p>
		<p class="mt-1 text-xs text-slate-600">
			Aquí verás listados de artículos, herramientas para revisar contenidos en equipo y accesos
			rápidos a las secciones más usadas, con una interfaz simple y minimalista.
		</p>
	</section>
</section>
