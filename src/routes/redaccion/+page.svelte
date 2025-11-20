<script lang="ts">
	import { enhance } from '$app/forms';
	import FileUploader from '$lib/components/FileUploader.svelte';
	let { data, form } = $props();

	let showForm = $state(false);
</script>

<section class="space-y-8">
	<header class="flex items-center justify-between">
		<div class="space-y-1">
			<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Panel de redacción</p>
			<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
				Hola, {data.user.email}
			</h1>
		</div>
		<button
			onclick={() => (showForm = !showForm)}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
				use:enhance
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
							{#each data.categories as category}
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
					maxSize={4.5}
				/>

				<FileUploader
					accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
					label="Archivos Adjuntos (PDF, Word, Excel)"
					name="attachments"
					maxSize={4.5}
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
						class="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
					>
						Guardar Artículo
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
				{#each data.articles as article}
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
