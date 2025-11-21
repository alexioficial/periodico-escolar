<script lang="ts">
	let {
		file = null,
		previewUrl = null,
		onClose
	} = $props<{
		file: File | null;
		previewUrl: string | null;
		onClose: () => void;
	}>();

	let isVisible = $derived(file !== null);

	const getFileType = (f: File | null) => {
		if (!f) return 'unknown';
		if (f.type.startsWith('image/')) return 'image';
		if (f.type.startsWith('video/')) return 'video';
		return 'document';
	};

	const fileType = $derived(getFileType(file));

	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
	};

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isVisible) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isVisible}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-2xl bg-white shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Botón cerrar -->
			<button
				onclick={onClose}
				class="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 text-white transition-colors hover:bg-slate-900"
				aria-label="Cerrar"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="h-5 w-5"
				>
					<path
						d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
					/>
				</svg>
			</button>

			<!-- Contenido del modal -->
			<div class="p-6">
				{#if fileType === 'image' && previewUrl}
					<img
						src={previewUrl}
						alt={file?.name || 'Preview'}
						class="max-h-[80vh] w-auto rounded-lg object-contain"
					/>
				{:else if fileType === 'video' && previewUrl}
					<video
						src={previewUrl}
						controls
						class="max-h-[80vh] w-auto rounded-lg"
						aria-label={file?.name || 'Video preview'}
					>
						<track kind="captions" />
					</video>
				{:else}
					<!-- Documento o archivo no visual -->
					<div
						class="flex min-h-[40vh] min-w-[40vw] flex-col items-center justify-center space-y-4 p-8"
					>
						<div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="h-10 w-10 text-slate-500"
							>
								<path
									fill-rule="evenodd"
									d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="text-center">
							<p class="text-lg font-semibold text-slate-900">Vista previa no disponible</p>
							<p class="mt-2 text-sm text-slate-600">{file?.name}</p>
							{#if file}
								<p class="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
