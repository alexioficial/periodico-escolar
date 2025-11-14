<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-50">
	<header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
		<div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
			<a href="/feed" class="flex flex-col">
				<span class="text-sm font-semibold tracking-tight">Periódico escolar</span>
				<span class="text-[11px] text-slate-400 leading-tight">Tu escuela</span>
			</a>

			<nav class="flex items-center gap-4 text-xs text-slate-300">
				<a href="/feed" class="hover:text-sky-400">Inicio</a>
				<a href="/redaccion" class="hover:text-sky-400">Redacción</a>
				{#if data.user}
					<span class="hidden sm:inline text-slate-500">•</span>
					<span class="hidden sm:inline text-slate-400">{data.user.email}</span>
					<form method="POST" action="/auth/logout">
						<button
							type="submit"
							class="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors"
						>
							Cerrar sesión
						</button>
					</form>
				{:else}
					<a
						href="/auth/login"
						class="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
					>
						Iniciar sesión
					</a>
				{/if}
			</nav>
		</div>
	</header>

	<main class="max-w-5xl mx-auto px-4 py-6">
		{@render children()}
	</main>
</div>
