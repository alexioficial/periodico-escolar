<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from '$lib/toast';
	let { data } = $props();

	type Article = (typeof data.articles)[number];

	// svelte-ignore state_referenced_locally
	let articles = $state<Article[]>([...data.articles]);
	// svelte-ignore state_referenced_locally
	let trackedPage = $state(data.pagination.currentPage);

	$effect(() => {
		// Dependemos SOLO de los datos del server; la fusión va en untrack
		// para no releer/reescribir `articles` dentro del propio effect
		// (causaba effect_update_depth_exceeded y mataba la reactividad).
		const incomingData = data.articles;
		const currentPage = data.pagination.currentPage;
		untrack(() => {
			if (currentPage !== trackedPage) {
				trackedPage = currentPage;
				articles = [...incomingData];
				return;
			}
			const incoming = new Map(incomingData.map((a) => [a._id, a]));
			articles = articles.map((a) => incoming.get(a._id) ?? a);
		});
	});

	async function readError(res: Response, fallback: string) {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function handleLike(article: Article) {
		const wasLiked = article.isLiked;
		article.isLiked = !wasLiked;
		article.likesCount += wasLiked ? -1 : 1;

		try {
			const res = await fetch(`/api/articles/${article._id}/like`, { method: 'POST' });
			if (!res.ok) throw new Error(await readError(res, 'No se pudo actualizar el me gusta'));
		} catch (e) {
			article.isLiked = wasLiked;
			article.likesCount += wasLiked ? 1 : -1;
			toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el me gusta');
		}
	}

	async function handleUnsave(article: Article) {
		const idx = articles.findIndex((a) => a._id === article._id);
		if (idx === -1) return;
		const removed = articles[idx];
		articles.splice(idx, 1);

		try {
			const res = await fetch(`/api/articles/${article._id}/save`, { method: 'POST' });
			if (!res.ok) throw new Error(await readError(res, 'No se pudo quitar de guardados'));
		} catch (e) {
			articles.splice(idx, 0, removed);
			toast.error(e instanceof Error ? e.message : 'No se pudo quitar de guardados');
		}
	}
</script>

<svelte:head>
	<title>Guardados · Periódico escolar</title>
</svelte:head>

<section class="space-y-8">
	<header class="space-y-3">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Tu Perfil</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
			Artículos Guardados
		</h1>
		<p class="max-w-2xl text-sm text-slate-600">
			Colección de noticias y publicaciones que has marcado para leer más tarde.
		</p>
	</header>

	{#if articles.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
			<p class="text-lg font-medium text-slate-900">No tienes guardados</p>
			<p class="mt-1 text-sm text-slate-500">Marca artículos con la estrella para verlos aquí.</p>
		</div>
	{:else}
		<div class="mx-auto grid max-w-2xl gap-8">
			{#each articles as article (article._id)}
				<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<!-- Header -->
					<div class="flex items-center justify-between border-b border-slate-50 p-4">
						<div class="flex items-center gap-3">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600"
							>
								{article.authorDisplay[0]?.toUpperCase() ?? 'A'}
							</div>
							<div>
								<p class="text-sm font-medium text-slate-900">
									{article.authorDisplay}
								</p>
								<p class="text-xs text-slate-500">
									{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}
								</p>
							</div>
						</div>
						<span
							class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
						>
							{article.category}
						</span>
					</div>

					<!-- Media Carousel -->
					{#if article.media && article.media.length > 0}
						<div class="group relative aspect-video bg-black">
							<div class="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto">
								{#each article.media as item (item.url)}
									<div
										class="flex h-full w-full flex-shrink-0 snap-center items-center justify-center"
									>
										{#if item.type === 'video'}
											<video
												src={item.url}
												controls
												class="max-h-full max-w-full"
												aria-label="Video del artículo"
											>
												<track kind="captions" />
											</video>
										{:else}
											<img src={item.url} alt="" class="h-full w-full object-contain" />
										{/if}
									</div>
								{/each}
							</div>
							{#if article.media.length > 1}
								<div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
									{#each article.media, i (i)}
										<div class="h-1.5 w-1.5 rounded-full bg-white/50"></div>
									{/each}
								</div>
								<div
									class="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white"
								>
									Slider (Desliza)
								</div>
							{/if}
						</div>
					{/if}

					<!-- Content -->
					<div class="p-5">
						<h3 class="mb-2 text-xl font-bold text-slate-900">
							{article.title}
						</h3>
						<p class="mb-4 text-sm whitespace-pre-wrap text-slate-600">
							{article.content}
						</p>

						<!-- Attachments -->
						{#if article.attachments && article.attachments.length > 0}
							<div class="mb-6 space-y-2">
								<p class="text-xs font-medium tracking-wider text-slate-500 uppercase">Adjuntos</p>
								{#each article.attachments as file (file.url)}
									<a
										href={file.url}
										download
										class="group flex items-center gap-3 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
									>
										<div
											class="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 group-hover:text-indigo-500"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												class="h-4 w-4"
											>
												<path
													d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0118 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-12A1.5 1.5 0 013 16.5v-13z"
												/>
											</svg>
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-slate-900">{file.name}</p>
											<p class="text-xs text-slate-500">
												{(file.size / 1024 / 1024).toFixed(2)} MB
											</p>
										</div>
										<div class="text-slate-400">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												class="h-5 w-5"
											>
												<path
													d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"
												/>
												<path
													d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"
												/>
											</svg>
										</div>
									</a>
								{/each}
							</div>
						{/if}

						<!-- Actions (Reusing actions from feed, pointing to feed actions) -->
						<div class="flex items-center justify-between pt-2">
							<div class="flex items-center gap-4">
								<button
									type="button"
									onclick={() => handleLike(article)}
									class="group flex items-center gap-1.5"
									aria-label={article.isLiked ? 'Quitar me gusta' : 'Me gusta'}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill={article.isLiked ? 'currentColor' : 'none'}
										stroke="currentColor"
										stroke-width="2"
										class="h-6 w-6 {article.isLiked
											? 'text-red-500'
											: 'text-slate-400 group-hover:text-red-500'} transition-colors"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
										/>
									</svg>
									<span
										class="text-sm font-medium {article.isLiked
											? 'text-red-600'
											: 'text-slate-600'}">{article.likesCount}</span
									>
								</button>

								<button
									class="text-slate-400 transition-colors hover:text-indigo-500"
									aria-label="Copiar enlace del artículo"
									onclick={() => {
										navigator.clipboard.writeText(
											window.location.origin + '/post/' + article._id
										);
										toast.success('Enlace copiado al portapapeles');
									}}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										class="h-6 w-6"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
										/>
									</svg>
								</button>
							</div>

							<button
								type="button"
								onclick={() => handleUnsave(article)}
								class="text-slate-400 transition-colors hover:text-amber-400"
								aria-label="Quitar de guardados"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill={article.isSaved ? 'currentColor' : 'none'}
									stroke="currentColor"
									stroke-width="2"
									class="h-6 w-6 {article.isSaved ? 'text-amber-400' : ''}"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
									/>
								</svg>
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>

		{#if data.pagination.totalPages > 1}
			<nav class="flex items-center justify-center gap-2 pt-6" aria-label="Paginación">
				{#if data.pagination.currentPage > 1}
					<a
						href={`?page=${data.pagination.currentPage - 1}`}
						class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						Anterior
					</a>
				{/if}
				<span class="self-center text-xs text-slate-500">
					Página {data.pagination.currentPage} de {data.pagination.totalPages}
				</span>
				{#if data.pagination.hasMore}
					<a
						href={`?page=${data.pagination.currentPage + 1}`}
						class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						Siguiente
					</a>
				{/if}
			</nav>
		{/if}
	{/if}
</section>
