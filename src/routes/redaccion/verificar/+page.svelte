<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/toast';
	import { articleImageAlt, formatArticleDate } from '$lib/articlePresentation';

	let { data } = $props();

	// Manejo del flujo de "rechazar con motivo": al apretar el botón, abrimos
	// un dialog con textarea. El submit lleva el motivo al servidor.
	let rejectingId = $state<string | null>(null);
	let rejectReason = $state('');
	let submittingId = $state<string | null>(null);

	function openReject(id: string) {
		rejectingId = id;
		rejectReason = '';
	}

	function closeReject() {
		rejectingId = null;
		rejectReason = '';
	}

	async function readError(res: Response, fallback: string) {
		try {
			const body = (await res.json()) as { message?: string };
			return body?.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function approve(id: string) {
		if (submittingId) return;
		submittingId = id;
		try {
			const res = await fetch(`/api/articles/${id}/moderate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ decision: 'approve' })
			});
			if (!res.ok) {
				toast.error('No se pudo aprobar', await readError(res, 'Error al aprobar el artículo'));
				return;
			}
			toast.success('Artículo publicado');
			await invalidateAll();
		} catch {
			toast.error('Error de red');
		} finally {
			submittingId = null;
		}
	}

	async function reject() {
		if (!rejectingId || submittingId) return;
		const id = rejectingId;
		submittingId = id;
		try {
			const res = await fetch(`/api/articles/${id}/moderate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ decision: 'reject', reason: rejectReason })
			});
			if (!res.ok) {
				toast.error('No se pudo rechazar', await readError(res, 'Error al rechazar el artículo'));
				return;
			}
			toast.success('Artículo rechazado');
			closeReject();
			await invalidateAll();
		} catch {
			toast.error('Error de red');
		} finally {
			submittingId = null;
		}
	}
</script>

<svelte:head>
	<title>Verificar artículos · Periódico sales</title>
</svelte:head>

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
			{#each data.articles as article (article._id)}
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
									Por: {article.authorUsername ?? article.authorEmail}
								</span>
							</div>
							<span class="text-xs text-slate-400">
								{formatArticleDate(article.createdAt)}
							</span>
						</div>

						<h3 class="mb-2 text-xl font-bold text-slate-900">{article.title}</h3>
						<p class="mb-4 text-sm text-slate-600">{article.excerpt}</p>

						<div class="mb-6 rounded-lg bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-700">
							{article.content}
						</div>

						{#if article.media && article.media.length > 0}
							<div class="mb-6 space-y-2">
								<p class="text-xs font-medium tracking-wider text-slate-500 uppercase">
									Multimedia ({article.media.length})
								</p>
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
									{#each article.media as item, i (i)}
										<div
											class="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-slate-900"
										>
											{#if item.type === 'video'}
												<!-- svelte-ignore a11y_media_has_caption -->
												<video
													src={item.url}
													controls
													playsinline
													preload="metadata"
													class="h-full w-full object-contain"
													aria-label="Video pendiente de revisión"
												></video>
											{:else}
												<img
													src={item.url}
													alt={articleImageAlt(article.title, i, article.media.length)}
													class="h-full w-full object-contain"
												/>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if article.attachments && article.attachments.length > 0}
							<div class="mb-6 space-y-2">
								<p class="text-xs font-medium tracking-wider text-slate-500 uppercase">
									Adjuntos ({article.attachments.length})
								</p>
								<ul class="space-y-1">
									{#each article.attachments as file (file.url)}
										<li>
											<a
												href={file.url}
												target="_blank"
												rel="noopener"
												class="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
											>
												<span class="truncate">{file.name}</span>
												<span class="text-xs text-slate-400">
													{(file.size / 1024 / 1024).toFixed(2)} MB
												</span>
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						<div class="flex items-center gap-3 border-t border-slate-100 pt-4">
							<button
								type="button"
								onclick={() => approve(article._id)}
								disabled={submittingId === article._id}
								class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{submittingId === article._id ? 'Procesando…' : 'Aprobar y Publicar'}
							</button>

							<button
								type="button"
								onclick={() => openReject(article._id)}
								class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
							>
								Rechazar
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

{#if rejectingId}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="reject-title"
	>
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
			<h2 id="reject-title" class="text-lg font-semibold text-slate-900">Rechazar artículo</h2>
			<p class="mt-1 text-sm text-slate-500">
				Opcionalmente explica el motivo. El autor verá esta nota en su panel de redacción.
			</p>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					reject();
				}}
				class="mt-4 space-y-3"
			>
				<textarea
					name="reason"
					bind:value={rejectReason}
					rows="4"
					maxlength="500"
					placeholder="Motivo (opcional). Máx. 500 caracteres."
					class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
				></textarea>
				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={closeReject}
						class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={submittingId === rejectingId}
						class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{submittingId === rejectingId ? 'Procesando…' : 'Confirmar rechazo'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
