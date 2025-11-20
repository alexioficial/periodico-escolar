<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let loadingMore = $state(false);

	async function loadMore() {
		if (loadingMore || !data.pagination.hasMore) return;
		loadingMore = true;

		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', (data.pagination.currentPage + 1).toString());

		await goto(`/feed?${params.toString()}`, {
			keepFocus: true,
			noScroll: true
		});

		loadingMore = false;
	}
</script>

<section class="space-y-8">
	<header class="space-y-3">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Periódico escolar</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
			Últimas Noticias
		</h1>
		<p class="max-w-2xl text-sm text-slate-600">
			Explora las historias más recientes de nuestra comunidad educativa.
		</p>
	</header>

	<nav class="flex flex-wrap gap-2">
		<a
			href="/feed"
			class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors
			{!data.currentCategoryId
				? 'bg-slate-900 text-white'
				: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
		>
			Todas
		</a>
		{#each data.categories as category}
			<a
				href="/feed?categoryId={category._id}"
				class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors
				{data.currentCategoryId === category._id
					? 'bg-slate-900 text-white'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
			>
				{category.name}
			</a>
		{/each}
	</nav>

	{#if data.articles.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
			<p class="text-lg font-medium text-slate-900">No hay noticias</p>
			<p class="mt-1 text-sm text-slate-500">
				{#if data.currentCategory}
					No hay artículos publicados en la categoría "{data.currentCategory}" todavía.
				{:else}
					Aún no se han publicado artículos en el periódico.
				{/if}
			</p>
		</div>
	{:else}
		<div class="mx-auto grid max-w-2xl gap-8">
			{#each data.articles as article}
				<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<!-- Header -->
					<div class="flex items-center justify-between border-b border-slate-50 p-4">
						<div class="flex items-center gap-3">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600"
							>
								{article.authorEmail[0].toUpperCase()}
							</div>
							<div>
								<p class="text-sm font-medium text-slate-900">
									{article.authorEmail.split('@')[0]}
								</p>
								<p class="text-xs text-slate-500">
									{new Date(article.publishedAt).toLocaleDateString()}
								</p>
							</div>
						</div>
						<span
							class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
						>
							{article.categoryName}
						</span>
					</div>

					<!-- Media Carousel -->
					{#if article.media && article.media.length > 0}
						<div class="group relative aspect-video bg-black">
							<div class="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto">
								{#each article.media as item}
									<div
										class="flex h-full w-full flex-shrink-0 snap-center items-center justify-center"
									>
										{#if item.type === 'video'}
											<video src={item.url} controls class="max-h-full max-w-full"></video>
										{:else}
											<img src={item.url} alt="" class="h-full w-full object-contain" />
										{/if}
									</div>
								{/each}
							</div>
							{#if article.media.length > 1}
								<div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
									{#each article.media as _, i}
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
								{#each article.attachments as file}
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

						<!-- Actions -->
						<div class="flex items-center justify-between pt-2">
							<div class="flex items-center gap-4">
								<form method="POST" action="?/toggleLike" use:enhance>
									<input type="hidden" name="id" value={article._id} />
									<button type="submit" class="group flex items-center gap-1.5">
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
								</form>

								<button
									class="text-slate-400 transition-colors hover:text-indigo-500"
									onclick={() => {
										navigator.clipboard.writeText(
											window.location.origin + '/feed?id=' + article._id
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

							<form method="POST" action="?/toggleSave" use:enhance>
								<input type="hidden" name="id" value={article._id} />
								<button type="submit" class="text-slate-400 transition-colors hover:text-amber-400">
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
							</form>
						</div>
					</div>
				</article>
			{/each}
		</div>

		<!-- Load More Button -->
		{#if data.pagination.hasMore}
			<div class="flex justify-center pt-8">
				<button
					onclick={loadMore}
					disabled={loadingMore}
					class="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loadingMore ? 'Cargando...' : 'Cargar más artículos'}
				</button>
			</div>
		{/if}
	{/if}
</section>
