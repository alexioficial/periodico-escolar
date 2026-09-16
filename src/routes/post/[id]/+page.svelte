<script lang="ts">
	import { goto } from '$app/navigation';
	import { brandTitle } from '$lib/brand';
	import { toast } from '$lib/toast';
	import { shareDialog } from '$lib/shareDialog';
	import { articleImageAlt, formatArticleDate } from '$lib/articlePresentation';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let article = $state({ ...data.article });
	let liking = $state(false);

	function requireLogin() {
		toast.info('Inicia sesión', 'Necesitas una cuenta para interactuar con los artículos.');
		const returnTo = `${window.location.pathname}${window.location.search}`;
		goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
	}

	async function readError(res: Response, fallback: string) {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function handleLike() {
		if (!data.user) return requireLogin();
		if (liking) return;
		liking = true;
		const wasLiked = article.isLiked;
		const desiredLiked = !wasLiked;
		article.isLiked = desiredLiked;
		article.likesCount += wasLiked ? -1 : 1;

		try {
			const res = await fetch(`/api/articles/${article._id}/like`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ liked: desiredLiked })
			});
			if (!res.ok) throw new Error(await readError(res, 'No se pudo actualizar el me gusta'));
			const persisted = (await res.json()) as { isLiked: boolean; likesCount: number };
			article.isLiked = persisted.isLiked;
			article.likesCount = persisted.likesCount;
		} catch (error) {
			article.isLiked = wasLiked;
			article.likesCount += wasLiked ? 1 : -1;
			toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el me gusta');
		} finally {
			liking = false;
		}
	}

	async function handleSave() {
		if (!data.user) return requireLogin();

		const wasSaved = article.isSaved;
		article.isSaved = !wasSaved;

		try {
			const res = await fetch(`/api/articles/${article._id}/save`, { method: 'POST' });
			if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar el artículo'));
		} catch (e) {
			article.isSaved = wasSaved;
			toast.error(e instanceof Error ? e.message : 'No se pudo guardar el artículo');
		}
	}

	function handleShare() {
		shareDialog.open({
			url: window.location.origin + '/post/' + article._id,
			title: article.title
		});
	}
</script>

<svelte:head>
	<title>{brandTitle(article.title)}</title>
</svelte:head>

<article class="pb-10 sm:pb-16">
	<a
		href="/feed"
		class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-4 focus-visible:outline-none"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			class="h-4 w-4"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
		Volver al inicio
	</a>

	<header class="mx-auto max-w-4xl pt-10 pb-8 sm:pt-16 sm:pb-12">
		<div class="mb-5 flex items-center gap-3">
			<span class="h-0.5 w-10 bg-amber-400" aria-hidden="true"></span>
			<p class="text-xs font-bold tracking-[0.22em] text-slate-600 uppercase">
				{article.categoryName}
			</p>
		</div>

		<h1
			class="max-w-4xl text-4xl leading-[1.04] font-bold tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-6xl"
		>
			{article.title}
		</h1>

		<div
			class="mt-8 flex flex-col gap-5 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white"
					aria-hidden="true"
				>
					{article.authorDisplay[0]?.toUpperCase() ?? 'A'}
				</div>
				<div>
					<p class="text-sm font-semibold text-slate-900">{article.authorDisplay}</p>
					<p class="mt-0.5 text-xs tracking-wide text-slate-500">
						Publicado el {formatArticleDate(article.publishedAt)}
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2" aria-label="Acciones del artículo">
				<button
					type="button"
					onclick={handleLike}
					disabled={liking}
					aria-pressed={article.isLiked}
					class="group inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-red-200 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:outline-none"
					aria-label={article.isLiked ? 'Quitar me gusta' : 'Me gusta'}
				>
					<svg
						viewBox="0 0 24 24"
						fill={article.isLiked ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width="2"
						class="h-5 w-5 {article.isLiked
							? 'text-red-500'
							: 'text-slate-500 group-hover:text-red-500'} transition-colors"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
						/>
					</svg>
					<span>{article.likesCount}</span>
				</button>
				<button
					type="button"
					onclick={handleShare}
					class="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-5 w-5"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
						/>
					</svg>
					Compartir
				</button>

				<button
					type="button"
					onclick={handleSave}
					aria-pressed={article.isSaved}
					class="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold {article.isSaved
						? 'border-amber-300 text-amber-700'
						: 'text-slate-700 hover:border-amber-300 hover:text-amber-700'} transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:outline-none"
					aria-label={article.isSaved ? 'Quitar de guardados' : 'Guardar artículo'}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill={article.isSaved ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width="2"
						class="h-5 w-5"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
						/>
					</svg>
					{article.isSaved ? 'Guardado' : 'Guardar'}
				</button>
			</div>
		</div>
	</header>

	{#if article.media && article.media.length > 0}
		<figure class="-mx-4 overflow-hidden bg-slate-950 sm:mx-0">
			<div
				class="scrollbar-hide flex aspect-video max-h-[72vh] min-h-64 w-full snap-x snap-mandatory overflow-x-auto"
			>
				{#each article.media as item, mediaIndex (item.url)}
					<div class="flex h-full w-full shrink-0 snap-center items-center justify-center">
						{#if item.type === 'video'}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src={item.url}
								controls
								playsinline
								preload="metadata"
								class="h-full w-full object-contain"
								aria-label="Video del artículo"
							></video>
						{:else}
							<img
								src={item.url}
								alt={articleImageAlt(article.title, mediaIndex, article.media.length)}
								class="h-full w-full object-contain"
							/>
						{/if}
					</div>
				{/each}
			</div>
			{#if article.media.length > 1}
				<figcaption
					class="flex items-center justify-center gap-2 border-t border-white/10 bg-slate-950 px-4 py-2.5 text-xs font-medium tracking-wide text-slate-300"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-4 w-4"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
					</svg>
					Desliza para ver los {article.media.length} archivos multimedia
				</figcaption>
			{/if}
		</figure>
	{/if}

	<div class="mx-auto max-w-3xl pt-10 sm:pt-14">
		<p class="text-lg leading-8 whitespace-pre-wrap text-slate-700 sm:text-xl sm:leading-9">
			{article.content}
		</p>

		{#if article.attachments && article.attachments.length > 0}
			<aside class="mt-12 border-y border-slate-200 py-7" aria-labelledby="attachments-title">
				<div class="mb-4 flex items-center justify-between gap-4">
					<h2
						id="attachments-title"
						class="text-sm font-bold tracking-[0.16em] text-slate-900 uppercase"
					>
						Archivos adjuntos
					</h2>
					<span class="text-xs text-slate-500">{article.attachments.length}</span>
				</div>

				<div class="divide-y divide-slate-200">
					{#each article.attachments as file (file.url)}
						<a
							href={file.url}
							download
							class="group flex items-center gap-4 py-4 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
						>
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-amber-100 group-hover:text-amber-700"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
									class="h-5 w-5"
									aria-hidden="true"
								>
									<path
										d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0118 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-12A1.5 1.5 0 013 16.5v-13z"
									/>
								</svg>
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold text-slate-900">{file.name}</p>
								<p class="mt-0.5 text-xs text-slate-500">
									{(file.size / 1024 / 1024).toFixed(2)} MB
								</p>
							</div>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-700"
								aria-hidden="true"
							>
								<path
									d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"
								/>
								<path
									d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"
								/>
							</svg>
						</a>
					{/each}
				</div>
			</aside>
		{/if}
	</div>
</article>
