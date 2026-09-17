<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from '$lib/toast';
	let { id, title }: { id: string; title: string } = $props();
	let confirmation: HTMLDetailsElement;
	let deleting = $state(false);
	let message = $state('');
	const submit: SubmitFunction = () => {
		deleting = true;
		message = '';
		return async ({ result, update }) => {
			deleting = false;
			if (result.type === 'success') {
				const data = result.data as { message?: string; cleanupFailed?: boolean };
				toast.success(data.message ?? 'Artículo eliminado');
				confirmation.open = false;
				await update({ reset: true });
			} else if (result.type === 'failure') {
				message =
					(result.data as { message?: string })?.message ?? 'No se pudo eliminar el artículo';
				await update({ reset: false });
			} else if (result.type === 'redirect') {
				await update();
			} else {
				message = 'No se pudo eliminar el artículo. Intenta de nuevo.';
			}
		};
	};
</script>

<details bind:this={confirmation} class="w-full">
	<summary
		class="w-fit cursor-pointer rounded-lg px-3 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
		>Eliminar</summary
	>
	<form
		method="POST"
		action="?/delete"
		use:enhance={submit}
		class="mt-2 space-y-3 rounded-lg border border-red-200 bg-red-50 p-3"
	>
		<input type="hidden" name="id" value={id} />
		<p class="text-sm break-words text-slate-900">
			¿Eliminar «{title}»? Esta acción es permanente y también eliminará sus archivos.
		</p>
		{#if message}<p role="alert" class="text-sm text-red-800">{message}</p>{/if}
		<div class="flex flex-wrap gap-2">
			<a
				href="/redaccion"
				aria-disabled={deleting}
				onclick={(event) => {
					event.preventDefault();
					if (deleting) return;
					confirmation.open = false;
					message = '';
				}}
				class="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 aria-disabled:opacity-60"
				>Volver</a
			>
			<button
				type="submit"
				disabled={deleting}
				class="min-h-11 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-70"
				>{deleting ? 'Eliminando…' : 'Eliminar'}</button
			>
		</div>
	</form>
</details>
