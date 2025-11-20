<script lang="ts">
	import { toast } from '$lib/toast';
	import FilePreviewModal from './FilePreviewModal.svelte';

	let {
		accept = '*',
		label = 'Archivos',
		name,
		maxSize = 4.5
	} = $props<{
		accept?: string;
		label?: string;
		name: string;
		maxSize?: number;
	}>();

	let selectedFiles = $state<File[]>([]);
	let previewUrls = $state<Map<File, string>>(new Map());
	let isDragging = $state(false);
	let fileInputRef: HTMLInputElement; // Para seleccionar archivos
	let formInputRef: HTMLInputElement; // Para enviar en el formulario

	// Modal state
	let modalFile = $state<File | null>(null);
	let modalPreviewUrl = $state<string | null>(null);

	const maxSizeBytes = maxSize * 1024 * 1024;

	// Crear preview URL para un archivo
	function createPreviewUrl(file: File): string {
		const url = URL.createObjectURL(file);
		previewUrls.set(file, url);
		return url;
	}

	// Validar y agregar archivos
	function addFiles(files: FileList | File[]) {
		const fileArray = Array.from(files);

		for (const file of fileArray) {
			// Validar tamaño
			if (file.size > maxSizeBytes) {
				toast(`El archivo ${file.name} es demasiado grande. Tamaño máximo: ${maxSize} MB`, 'error');
				continue;
			}

			// Validar tipo (si hay restricción)
			if (accept !== '*' && !isFileTypeAccepted(file)) {
				toast(`El tipo de archivo ${file.name} no es permitido`, 'error');
				continue;
			}

			// Agregar archivo
			selectedFiles.push(file);
			createPreviewUrl(file);
		}

		selectedFiles = [...selectedFiles]; // Trigger reactivity
		syncFilesToInput(); // Sincronizar con input file oculto
	}

	// Verificar si el tipo de archivo es aceptado
	function isFileTypeAccepted(file: File): boolean {
		const acceptTypes = accept.split(',').map((t) => t.trim());

		return acceptTypes.some((type) => {
			if (type.startsWith('.')) {
				return file.name.toLowerCase().endsWith(type.toLowerCase());
			}
			if (type.endsWith('/*')) {
				const category = type.split('/')[0];
				return file.type.startsWith(category + '/');
			}
			return file.type === type;
		});
	}

	// Manejar selección de archivos
	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			addFiles(input.files);
			input.value = ''; // Reset input
		}
	}

	// Eliminar archivo
	function removeFile(file: File) {
		const index = selectedFiles.indexOf(file);
		if (index > -1) {
			selectedFiles.splice(index, 1);
			selectedFiles = [...selectedFiles];

			// Limpiar preview URL
			const url = previewUrls.get(file);
			if (url) {
				URL.revokeObjectURL(url);
				previewUrls.delete(file);
			}

			// Sincronizar con input file
			syncFilesToInput();
		}
	}

	// Sincronizar archivos seleccionados con el input file oculto
	function syncFilesToInput() {
		if (!formInputRef) return;

		// Crear un DataTransfer para poder asignar files al input
		const dataTransfer = new DataTransfer();
		selectedFiles.forEach((file) => {
			dataTransfer.items.add(file);
		});

		// Asignar el FileList al input de formulario
		formInputRef.files = dataTransfer.files;
	}

	// Abrir modal de preview
	function openPreview(file: File) {
		modalFile = file;
		modalPreviewUrl = previewUrls.get(file) || null;
	}

	// Cerrar modal
	function closePreview() {
		modalFile = null;
		modalPreviewUrl = null;
	}

	// Drag & Drop handlers
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		if (e.dataTransfer?.files) {
			addFiles(e.dataTransfer.files);
		}
	}

	// Obtener icono según tipo de archivo
	function getFileIcon(file: File) {
		if (file.type.startsWith('image/')) return '🖼️';
		if (file.type.startsWith('video/')) return '🎥';
		if (file.type.includes('pdf')) return '📄';
		if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx'))
			return '📝';
		if (
			file.type.includes('spreadsheet') ||
			file.name.endsWith('.xls') ||
			file.name.endsWith('.xlsx')
		)
			return '📊';
		if (
			file.type.includes('presentation') ||
			file.name.endsWith('.ppt') ||
			file.name.endsWith('.pptx')
		)
			return '📽️';
		return '📎';
	}

	// Limpiar URLs cuando el componente se destruye
	$effect(() => {
		return () => {
			previewUrls.forEach((url) => URL.revokeObjectURL(url));
		};
	});
</script>

<div class="space-y-3">
	<label class="text-sm font-medium text-slate-700">
		{label}
	</label>

	<!-- Drag & Drop Zone + Grid de archivos -->
	<div
		class="rounded-lg border-2 border-dashed p-4 transition-colors {isDragging
			? 'border-indigo-500 bg-indigo-50'
			: 'border-slate-300 bg-slate-50'}"
		ondragenter={handleDragEnter}
		ondragleave={handleDragLeave}
		ondragover={handleDragOver}
		ondrop={handleDrop}
		role="button"
		tabindex="0"
	>
		<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
			<!-- Archivos existentes -->
			{#each selectedFiles as file (file)}
				<div class="group relative">
					<button
						type="button"
						onclick={() => openPreview(file)}
						class="flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-slate-200 bg-white shadow-sm transition-all hover:border-indigo-500 hover:shadow-md"
					>
						{#if file.type.startsWith('image/')}
							<img src={previewUrls.get(file)} alt={file.name} class="h-full w-full object-cover" />
						{:else if file.type.startsWith('video/')}
							<div class="flex h-full w-full flex-col items-center justify-center bg-slate-100">
								<span class="text-3xl">🎥</span>
								<span class="mt-1 text-[10px] text-slate-500">Video</span>
							</div>
						{:else}
							<div class="flex h-full w-full flex-col items-center justify-center bg-slate-100">
								<span class="text-3xl">{getFileIcon(file)}</span>
								<span class="mt-1 px-1 text-center text-[10px] leading-tight text-slate-500">
									{file.name.split('.').pop()?.toUpperCase()}
								</span>
							</div>
						{/if}
					</button>

					<!-- Botón eliminar -->
					<button
						type="button"
						onclick={() => removeFile(file)}
						class="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 hover:bg-red-600"
						aria-label="Eliminar archivo"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="h-4 w-4"
						>
							<path
								d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
							/>
						</svg>
					</button>
				</div>
			{/each}

			<!-- Botón agregar más archivos -->
			<button
				type="button"
				onclick={() => fileInputRef.click()}
				class="flex aspect-square w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-slate-400 transition-all hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="h-8 w-8"
				>
					<path
						d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"
					/>
				</svg>
				<span class="mt-1 text-xs font-medium">Agregar</span>
			</button>
		</div>

		{#if selectedFiles.length === 0}
			<p class="mt-3 text-center text-xs text-slate-500">
				Arrastra archivos aquí o haz clic en el botón "+"
			</p>
		{/if}
	</div>

	<!-- Input file para SELECCIONAR archivos (se resetea cada vez) -->
	<input
		bind:this={fileInputRef}
		type="file"
		{accept}
		multiple
		onchange={handleFileSelect}
		class="hidden"
		aria-label={label}
	/>

	<!-- Input file OCULTO para ENVIAR en el formulario (mantiene todos los archivos) -->
	<input type="file" {name} {accept} multiple class="hidden" bind:this={formInputRef} />

	<!-- Información adicional -->
	<p class="text-xs text-slate-500">
		Tamaño máximo por archivo: {maxSize} MB
	</p>
</div>

<!-- Modal de preview -->
<FilePreviewModal file={modalFile} previewUrl={modalPreviewUrl} onClose={closePreview} />
