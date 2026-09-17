<script lang="ts">
	import { brandTitle } from '$lib/brand';
	import OwnArticleEditForm from '$lib/components/OwnArticleEditForm.svelte';
	let { data, form } = $props();
	const article = $derived(form?.draft ? { ...data.article, ...form.draft } : data.article);
</script>

<svelte:head><title>{brandTitle('Editar artículo')}</title></svelte:head>
<section class="mx-auto max-w-4xl space-y-6">
	<header class="space-y-2">
		<a
			href="/redaccion"
			class="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 hover:underline"
			>Volver a Mis Artículos</a
		>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900">Editar artículo</h1>
	</header>
	<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
		<OwnArticleEditForm
			{article}
			categories={data.categories}
			isStaff={data.isStaff}
			message={form?.message ?? ''}
		/>
	</div>
</section>
