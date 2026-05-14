<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from '$lib/toast';
	import FileUploader from '$lib/components/FileUploader.svelte';
	let { data } = $props();

	let showForm = $state(false);
	let isSaving = $state(false);
	let mediaApi = $state<{ clear: () => void } | null>(null);
	let attachmentsApi = $state<{ clear: () => void } | null>(null);

	const isSuperadmin = $derived(data.user.role === 'superadmin');
	const isStaff = $derived(['admin', 'superadmin'].includes(data.user.role));
	const maxImages = $derived(isStaff ? Infinity : 10);
	const maxVideos = $derived(isStaff ? Infinity : 2);
	const maxAttachments = $derived(isStaff ? Infinity : 3);
	const maxFileSizeMb = $derived(isSuperadmin ? Infinity : isStaff ? 150 : 50);

	const handleSubmit: SubmitFunction = () => {
		isSaving = true;
		return async ({ result, update }) => {
			isSaving = false;

			if (result.type === 'success') {
				toast.success(
					isStaff ? 'Artículo publicado correctamente' : 'Artículo enviado a revisión',
					undefined,
					6000
				);
				mediaApi?.clear();
				attachmentsApi?.clear();
				await update({ reset: true });
				showForm = false;
			} else if (result.type === 'failure') {
				const msg =
					(result.data as { message?: string } | undefined)?.message ??
					'No se pudo guardar el artículo';
				toast.error(msg);
				await update({ reset: false });
			} else if (result.type === 'redirect') {
				await update();
			} else {
				toast.error('Error inesperado al guardar el artículo. Intenta de nuevo.');
			}
		};
	};
</script>

<svelte:head>
	<title>Redacción · Periódico escolar</title>
</svelte:head>

<section class="space-y-8">
	<header class="flex items-center justify-between">
		<div class="space-y-1">
			<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Panel de redacción</p>
			<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
				Hola, {data.user.username ?? data.user.name ?? data.user.email.split('@')[0]}
			</h1>
		</div>
		<button
			onclick={() => (showForm = !showForm)}
			disabled={isSaving}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
		>
			{showForm ? 'Cancelar' : 'Nuevo Artículo'}
		</button>
	</header>

	{#if showForm}
		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-lg font-medium text-slate-900">Escribir nuevo artículo</h2>
			<form
				method="POST"
				action="?/create"
				use:enhance={handleSubmit}
				enctype="multipart/form-data"
				class="space-y-4"
			>
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<label for="title" class="text-sm font-medium text-slate-700">Título</label>
						<input
							type="text"
							name="title"
							id="title"
							required
							class="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
					</div>
					<div class="space-y-2">
						<label for="categoryId" class="text-sm font-medium text-slate-700">Categoría</label>
						<select
							name="categoryId"
							id="categoryId"
							required
							class="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500"
						>
							<option value="">Selecciona una categoría</option>
							{#each data.categories as category (category._id)}
								<option value={category._id}>{category.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="space-y-2">
					<label for="excerpt" class="text-sm font-medium text-slate-700">Extracto (Resumen)</label>
					<textarea
						name="excerpt"
						id="excerpt"
						rows="2"
						required
						class="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500"
					></textarea>
				</div>

				<FileUploader
					accept="image/*,video/*"
					label="Multimedia (Fotos y Videos)"
					name="media"
					maxSize={maxFileSizeMb}
					{maxImages}
					{maxVideos}
					bind:api={mediaApi}
				/>

				<FileUploader
					accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
					label="Archivos Adjuntos (PDF, Word, Excel)"
					name="attachments"
					maxSize={maxFileSizeMb}
					maxItems={maxAttachments}
					bind:api={attachmentsApi}
				/>

				<div class="space-y-2">
					<label for="content" class="text-sm font-medium text-slate-700">Contenido</label>
					<textarea
						name="content"
						id="content"
						rows="10"
						required
						class="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500"
					></textarea>
				</div>

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={isSaving}
						class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{#if isSaving}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							>
								<path d="M21 12a9 9 0 1 1-6.219-8.56" />
							</svg>
							Guardando...
						{:else}
							Guardar Artículo
						{/if}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<section class="space-y-4">
		<h2 class="text-lg font-medium text-slate-900">Mis Artículos</h2>

		{#if data.articles.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
				<p class="text-sm text-slate-500">No has escrito ningún artículo todavía.</p>
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each data.articles as article (article._id)}
					<article
						class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
					>
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<span
									class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
								>
									{article.category}
								</span>
								<span
									class:text-green-600={article.status === 'published'}
									class:text-amber-600={article.status === 'pending'}
									class:text-red-600={article.status === 'rejected'}
									class="text-xs font-medium capitalize"
								>
									{article.status === 'published'
										? 'Publicado'
										: article.status === 'pending'
											? 'Pendiente'
											: 'Rechazado'}
								</span>
							</div>
							<h3 class="line-clamp-2 text-lg font-semibold text-slate-900">{article.title}</h3>
							<p class="line-clamp-3 text-sm text-slate-600">{article.excerpt}</p>

							{#if article.status === 'rejected' && article.rejectionReason}
								<div class="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700">
									<p class="mb-1 font-semibold tracking-wider text-red-600 uppercase">
										Motivo del rechazo
									</p>
									<p class="whitespace-pre-wrap">{article.rejectionReason}</p>
								</div>
							{/if}
						</div>
						<div class="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
							{new Date(article.createdAt).toLocaleDateString()}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</section>
