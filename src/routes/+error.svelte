<script lang="ts">
	import { page } from '$app/state';

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

	const statusCode = page.status;
	const pageError = page.error as any;

	const isClientError = statusCode >= 400 && statusCode < 500;
	const title = titles[statusCode] ?? `Error ${statusCode}`;
	const description =
		descriptions[statusCode] ??
		(isClientError
			? 'Hubo un problema con tu solicitud. Revisa los datos e inténtalo de nuevo.'
			: 'Hubo un problema al procesar tu solicitud. Intenta nuevamente en unos minutos.');
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<section
		class="w-full max-w-xl space-y-6 rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-xl"
	>
		<header class="space-y-2">
			<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Error {statusCode}</p>
			<h1 class="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
			<p class="text-sm text-slate-600">{description}</p>
		</header>

		<div class="flex flex-wrap items-center gap-3 text-xs">
			<a
				href="/feed"
				class="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400"
			>
				Ir al inicio
			</a>
			<button
				type="button"
				onclick={() => history.back()}
				class="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
			>
				Volver atrás
			</button>
		</div>

		{#if showDetails && pageError}
			<div class="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
				<p class="text-[11px] font-medium text-slate-500">Detalles técnicos (solo en desarrollo)</p>
				<pre
					class="max-h-48 overflow-auto text-[11px] break-words whitespace-pre-wrap text-slate-600">{pageError?.message}</pre>
			</div>
		{/if}
	</section>
</div>
