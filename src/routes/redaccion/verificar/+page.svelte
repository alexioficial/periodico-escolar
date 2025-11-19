<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();
</script>

<section class="space-y-8">
	<header class="space-y-3">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Administración</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
			Verificar Artículos
		</h1>
		<p class="max-w-2xl text-sm text-slate-600">
			Revisa las publicaciones pendientes de los estudiantes. Aprueba para publicar o rechaza para
			devolver al borrador.
		</p>
	</header>

	{#if data.articles.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
			<p class="text-lg font-medium text-slate-900">¡Todo al día!</p>
			<p class="mt-1 text-sm text-slate-500">No hay artículos pendientes de verificación.</p>
		</div>
	{:else}
		<div class="grid gap-6">
			{#each data.articles as article}
				<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div class="p-6">
						<div class="mb-4 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span
									class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
								>
									{article.category}
								</span>
								<span class="text-xs text-slate-500">
									Por: {article.authorEmail}
								</span>
							</div>
							<span class="text-xs text-slate-400">
								{new Date(article.createdAt).toLocaleDateString()}
							</span>
						</div>

						<h3 class="mb-2 text-xl font-bold text-slate-900">{article.title}</h3>
						<p class="mb-4 text-sm text-slate-600">{article.excerpt}</p>

						<div class="mb-6 rounded-lg bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-700">
							{article.content}
						</div>

						<div class="flex items-center gap-3 border-t border-slate-100 pt-4">
							<form method="POST" action="?/approve" use:enhance>
								<input type="hidden" name="id" value={article._id} />
								<button
									type="submit"
									class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
								>
									Aprobar y Publicar
								</button>
							</form>

							<form method="POST" action="?/reject" use:enhance>
								<input type="hidden" name="id" value={article._id} />
								<button
									type="submit"
									class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
								>
									Rechazar
								</button>
							</form>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>
