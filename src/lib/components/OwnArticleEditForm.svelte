<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ArticleEditor from '$lib/components/ArticleEditor.svelte';
	let {
		article,
		categories,
		isStaff,
		message = ''
	}: {
		article: {
			title: string;
			excerpt: string;
			categoryId: string;
			content: string;
			contentHtml: string;
			media?: { type: string }[];
			attachments?: { name: string }[];
		};
		categories: { _id: string; name: string }[];
		isStaff: boolean;
		message?: string;
	} = $props();
	let title = $state(untrack(() => article.title));
	let excerpt = $state(untrack(() => article.excerpt));
	let categoryId = $state(untrack(() => article.categoryId));
	let saving = $state(false);
	let errorMessage = $state('');
	const submit: SubmitFunction = () => {
		saving = true;
		errorMessage = '';
		return async ({ result, update }) => {
			saving = false;
			if (result.type === 'redirect') {
				await update();
			} else if (result.type === 'failure') {
				errorMessage =
					(result.data as { message?: string })?.message ?? 'No se pudieron guardar los cambios';
				await update({ reset: false });
			} else if (result.type === 'error') {
				errorMessage =
					'No se pudieron guardar los cambios. Tu borrador se conserva; intenta de nuevo.';
			}
		};
	};
</script>

<form method="POST" action="?/edit" use:enhance={submit} class="space-y-6">
	<p class="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
		{isStaff
			? 'Tus cambios se publicarán al guardar.'
			: 'Al guardar, el artículo volverá a revisión y no será público hasta su aprobación.'}
	</p>
	{#if errorMessage || message}<p
			role="alert"
			class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
		>
			{errorMessage || message}
		</p>{/if}
	<div class="grid gap-4 md:grid-cols-2">
		<div class="space-y-2">
			<label for="edit-title" class="text-sm font-medium text-slate-700">Título</label>
			<input
				id="edit-title"
				name="title"
				type="text"
				required
				maxlength="200"
				bind:value={title}
				class="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
			/>
		</div>
		<div class="space-y-2">
			<label for="edit-category" class="text-sm font-medium text-slate-700">Categoría</label>
			<select
				id="edit-category"
				name="categoryId"
				required
				bind:value={categoryId}
				class="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
			>
				<option value="">Selecciona una categoría</option>
				{#each categories as category (category._id)}<option value={category._id}
						>{category.name}</option
					>{/each}
			</select>
		</div>
	</div>
	<div class="space-y-2">
		<label for="edit-excerpt" class="text-sm font-medium text-slate-700">Extracto (Resumen)</label>
		<textarea
			id="edit-excerpt"
			name="excerpt"
			rows="3"
			required
			maxlength="500"
			bind:value={excerpt}
			class="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
		></textarea>
	</div>
	<section
		aria-label="Archivos conservados"
		class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
	>
		<p class="font-medium">La multimedia y los adjuntos existentes se conservarán sin cambios.</p>
		<p class="mt-1">
			{article.media?.length ?? 0} archivos multimedia · {article.attachments?.length ?? 0} adjuntos
		</p>
		{#if article.attachments?.length}<ul class="mt-2 list-inside list-disc break-words">
				{#each article.attachments as attachment, index (index)}<li>{attachment.name}</li>{/each}
			</ul>{/if}
	</section>
	<ArticleEditor
		initialContentHtml={article.contentHtml}
		initialContent={article.content}
		disabled={saving}
	/>
	<div class="flex flex-wrap justify-end gap-3">
		<a
			href="/redaccion"
			class="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
			>Cancelar</a
		>
		<button
			type="submit"
			disabled={saving}
			class="min-h-11 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
			>{saving ? 'Guardando…' : 'Guardar cambios'}</button
		>
	</div>
</form>
