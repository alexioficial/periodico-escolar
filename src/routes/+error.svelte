<script lang="ts">
	let { error, status } = $props();

	const titles: Record<number, string> = {
		400: 'Solicitud incorrecta',
		401: 'No autorizado',
		403: 'Acceso denegado',
		404: 'Página no encontrada',
		500: 'Error interno del servidor'
	};

	const descriptions: Record<number, string> = {
		400: 'Revisa los datos enviados e inténtalo de nuevo.',
		401: 'Necesitas iniciar sesión para acceder a este contenido.',
		403: 'No tienes permisos para ver este contenido.',
		404: 'La página que buscas no existe o fue movida.',
		500: 'Ocurrió un problema inesperado en el servidor.'
	};

	const showDetails = import.meta.env.DEV;

	const isClientError = status >= 400 && status < 500;
	const title = titles[status] ?? (isClientError ? 'Algo salió mal con tu solicitud' : 'Algo se rompió en el servidor');
	const description =
		descriptions[status] ??
		(isClientError
			? 'Tu solicitud no se pudo completar. Intenta nuevamente o revisa los datos enviados.'
			: 'No pudimos completar tu solicitud. Intenta de nuevo en unos minutos.');
</script>

<div class="min-h-[60vh] flex items-center justify-center">
	<section class="w-full max-w-xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-8 shadow-xl">
		<header class="space-y-2">
			<p class="text-xs uppercase tracking-[0.25em] text-slate-500">Error {status}</p>
			<h1 class="text-2xl font-semibold tracking-tight text-slate-50">{title}</h1>
			<p class="text-sm text-slate-400">{description}</p>
		</header>

		<div class="flex flex-wrap items-center gap-3 text-xs">
			<a
				href="/feed"
				class="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
			>
				Ir al inicio
			</a>
			<button
				type="button"
				on:click={() => history.back()}
				class="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
			>
				Volver atrás
			</button>
		</div>

		{#if showDetails && error}
			<div class="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
				<p class="text-[11px] font-medium text-slate-400">Detalles técnicos (solo en desarrollo)</p>
				<pre class="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-400">{error.message}</pre>
			</div>
		{/if}
	</section>
</div>
