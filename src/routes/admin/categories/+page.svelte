<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/toast';
	import { confirmDialog } from '$lib/confirmDialog';
	import ValidatedInput from '$lib/components/ValidatedInput.svelte';
	let { data } = $props();

	let editingId = $state<string | null>(null);
	let editName = $state('');
	let newCategoryName = $state('');
	let newCategoryError = $state('');
	let busy = $state(false);

	function startEdit(id: string, name: string) {
		editingId = id;
		editName = name;
	}

	function cancelEdit() {
		editingId = null;
		editName = '';
	}

	async function readError(res: Response, fallback: string) {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		if (!newCategoryName || newCategoryName.trim() === '') {
			newCategoryError = 'El nombre de la categoría es requerido';
			return;
		}
		newCategoryError = '';
		busy = true;
		try {
			const res = await fetch('/api/categories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newCategoryName.trim() })
			});
			if (!res.ok) {
				newCategoryError = await readError(res, 'No se pudo crear la categoría');
				toast.error('Error', newCategoryError);
				return;
			}
			toast.success('Categoría creada exitosamente');
			newCategoryName = '';
			await invalidateAll();
		} catch {
			toast.error('Error de red');
		} finally {
			busy = false;
		}
	}

	async function handleUpdate(id: string) {
		if (busy) return;
		busy = true;
		try {
			const res = await fetch(`/api/categories/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: editName.trim() })
			});
			if (!res.ok) {
				toast.error('Error', await readError(res, 'No se pudo actualizar la categoría'));
				return;
			}
			toast.success('Categoría actualizada');
			cancelEdit();
			await invalidateAll();
		} catch {
			toast.error('Error de red');
		} finally {
			busy = false;
		}
	}

	async function handleDelete(id: string, name: string, articlesCount: number) {
		const confirmed = await confirmDialog.confirm({
			title: articlesCount > 0 ? 'No se puede eliminar' : 'Eliminar categoría',
			message:
				articlesCount > 0
					? `Esta categoría tiene ${articlesCount} artículo(s) asociado(s). No se puede eliminar porque hay artículos que la usan.`
					: `¿Estás seguro de que deseas eliminar la categoría "${name}"? Esta acción no se puede deshacer.`,
			variant: articlesCount > 0 ? 'warning' : 'danger',
			confirmText: 'Eliminar',
			cancelText: 'Cancelar'
		});
		if (!confirmed || articlesCount > 0) return;

		busy = true;
		try {
			const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				toast.error('Error', await readError(res, 'No se pudo eliminar la categoría'));
				return;
			}
			toast.success('Categoría eliminada');
			await invalidateAll();
		} catch {
			toast.error('Error de red');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Categorías · Periódico escolar</title>
</svelte:head>

<section class="space-y-8">
	<header class="space-y-3">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Super Admin</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
			Gestión de Categorías
		</h1>
		<p class="max-w-2xl text-sm text-slate-600">
			Administra las categorías de artículos. Las categorías no se pueden eliminar si tienen
			artículos asociados.
		</p>
	</header>

	<!-- Create Category Form -->
	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-medium text-slate-900">Crear Nueva Categoría</h2>
		<form onsubmit={handleCreate} novalidate class="flex gap-3">
			<ValidatedInput
				name="name"
				placeholder="Nombre de la categoría"
				required
				bind:value={newCategoryName}
				variant={newCategoryError ? 'danger' : 'default'}
				message={newCategoryError || 'Ingresa el nombre de la nueva categoría'}
				class="flex-1"
				oninput={() => {
					if (newCategoryError) {
						newCategoryError = '';
					}
				}}
			/>
			<button
				type="submit"
				disabled={busy}
				class="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
			>
				Crear
			</button>
		</form>
	</div>

	<!-- Categories List -->
	<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200">
			<thead class="bg-slate-50">
				<tr>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-slate-500 uppercase"
					>
						Nombre
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-slate-500 uppercase"
					>
						Slug
					</th>
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-slate-500 uppercase"
					>
						Artículos
					</th>
					<th
						class="px-6 py-3 text-right text-xs font-medium tracking-wider text-slate-500 uppercase"
					>
						Acciones
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 bg-white">
				{#each data.categories as category (category._id)}
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4">
							{#if editingId === category._id}
								<input
									type="text"
									bind:value={editName}
									class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
								/>
							{:else}
								<span class="text-sm font-medium text-slate-900">{category.name}</span>
							{/if}
						</td>
						<td class="px-6 py-4 text-sm text-slate-500">
							{category.slug}
						</td>
						<td class="px-6 py-4 text-sm text-slate-600">
							{category.articlesCount} artículo{category.articlesCount !== 1 ? 's' : ''}
						</td>
						<td class="px-6 py-4 text-right">
							{#if editingId === category._id}
								<div class="flex justify-end gap-2">
									<button
										type="button"
										onclick={() => handleUpdate(category._id)}
										disabled={busy}
										class="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
									>
										Guardar
									</button>
									<button
										type="button"
										onclick={cancelEdit}
										class="text-sm font-medium text-slate-600 hover:text-slate-700"
									>
										Cancelar
									</button>
								</div>
							{:else}
								<div class="flex justify-end gap-4">
									<button
										type="button"
										onclick={() => startEdit(category._id, category.name)}
										class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
									>
										Editar
									</button>
									<button
										type="button"
										onclick={() =>
											handleDelete(category._id, category.name, category.articlesCount)}
										disabled={category.articlesCount > 0 || busy}
										class="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-400"
									>
										Eliminar
									</button>
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
