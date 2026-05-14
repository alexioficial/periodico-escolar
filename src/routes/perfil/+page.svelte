<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from '$lib/toast';
	import AvatarCropper from '$lib/components/AvatarCropper.svelte';

	let { data } = $props();

	let isSaving = $state(false);
	let isSendingVerification = $state(false);
	let verifiedToastShown = $state(false);
	let cropperOpen = $state(false);
	let cropperSource = $state<File | null>(null);

	$effect(() => {
		if (
			!verifiedToastShown &&
			page.url.searchParams.get('verified') === '1' &&
			data.profile.emailVerified
		) {
			verifiedToastShown = true;
			toast.success('Correo verificado correctamente', undefined, 5000);
		}
		if (page.url.searchParams.get('verified') === '1') {
			const url = new URL(page.url);
			url.searchParams.delete('verified');
			history.replaceState(history.state, '', url);
		}
	});

	let fileInput: HTMLInputElement | undefined = $state();
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let removePicture = $state(false);

	const initials = $derived(
		(data.profile.name || data.profile.username || data.profile.email).slice(0, 2).toUpperCase()
	);

	const currentPictureUrl = $derived(
		removePicture ? null : (previewUrl ?? data.profile.pictureUrl ?? null)
	);

	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;

		if (!file) return;

		if (!file.type.startsWith('image/')) {
			toast.error('La foto de perfil debe ser una imagen');
			input.value = '';
			return;
		}

		if (file.size > 4.5 * 1024 * 1024) {
			toast.error('La imagen supera el máximo de 4.5 MB');
			input.value = '';
			return;
		}

		cropperSource = file;
		cropperOpen = true;
		input.value = '';
	}

	function setCroppedFile(file: File) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
		removePicture = false;

		if (fileInput && typeof DataTransfer !== 'undefined') {
			const dt = new DataTransfer();
			dt.items.add(file);
			fileInput.files = dt.files;
		}
	}

	function onCropConfirm(file: File) {
		setCroppedFile(file);
		cropperOpen = false;
		cropperSource = null;
	}

	function onCropCancel() {
		cropperOpen = false;
		cropperSource = null;
	}

	function clearSelection() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		selectedFile = null;
		if (fileInput) {
			fileInput.value = '';
			if (typeof DataTransfer !== 'undefined') {
				fileInput.files = new DataTransfer().files;
			}
		}
	}

	function toggleRemove() {
		removePicture = !removePicture;
		if (removePicture) clearSelection();
	}

	const handleSendVerification: SubmitFunction = () => {
		isSendingVerification = true;
		return async ({ result }) => {
			isSendingVerification = false;
			if (result.type === 'redirect') {
				toast.success('Te enviamos un código a tu correo', undefined, 5000);
				await goto(result.location);
			} else if (result.type === 'failure') {
				const msg =
					(result.data as { message?: string } | undefined)?.message ??
					'No se pudo enviar el código';
				toast.error(msg);
			} else if (result.type === 'success') {
				toast.success('Te enviamos un código a tu correo', undefined, 5000);
			} else {
				toast.error('Error inesperado al enviar el código');
			}
		};
	};

	const handleSubmit: SubmitFunction = () => {
		isSaving = true;
		return async ({ result }) => {
			isSaving = false;
			if (result.type === 'success') {
				toast.success('Perfil actualizado correctamente', undefined, 5000);
				clearSelection();
				removePicture = false;
				await invalidateAll();
			} else if (result.type === 'failure') {
				const msg =
					(result.data as { message?: string } | undefined)?.message ??
					'No se pudo actualizar el perfil';
				toast.error(msg);
			} else if (result.type === 'redirect') {
				window.location.href = result.location;
			} else {
				toast.error('Error inesperado al actualizar el perfil');
			}
		};
	};
</script>

<svelte:head>
	<title>Editar perfil · Periódico escolar</title>
</svelte:head>

<section class="mx-auto max-w-2xl space-y-8">
	<header class="space-y-1">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Tu cuenta</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Editar perfil</h1>
		<p class="text-sm text-slate-600">Actualiza tu nombre de usuario y tu foto de perfil.</p>
	</header>

	<form
		method="POST"
		action="?/update"
		use:enhance={handleSubmit}
		enctype="multipart/form-data"
		class="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
	>
		<div class="flex items-center gap-5">
			<div
				class="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-500"
			>
				{#if currentPictureUrl}
					<img src={currentPictureUrl} alt="Foto de perfil" class="h-full w-full object-cover" />
				{:else}
					{initials}
				{/if}
			</div>

			<div class="flex flex-1 flex-col gap-2">
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={() => fileInput?.click()}
						class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
					>
						{currentPictureUrl ? 'Cambiar foto' : 'Subir foto'}
					</button>
					{#if selectedFile}
						<button
							type="button"
							onclick={clearSelection}
							class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
						>
							Descartar cambio
						</button>
					{/if}
					{#if data.profile.pictureUrl && !selectedFile}
						<button
							type="button"
							onclick={toggleRemove}
							class="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
						>
							{removePicture ? 'Cancelar quitar foto' : 'Quitar foto'}
						</button>
					{/if}
				</div>
				<p class="text-xs text-slate-500">JPG, PNG o GIF. Máximo 4.5 MB.</p>
				{#if removePicture}
					<p class="text-xs font-medium text-red-600">La foto se eliminará al guardar.</p>
				{/if}
			</div>

			<input
				type="file"
				name="picture"
				accept="image/*"
				class="hidden"
				bind:this={fileInput}
				onchange={onFileChange}
			/>
			<input type="checkbox" name="removePicture" class="hidden" checked={removePicture} />
		</div>

		<div class="space-y-2">
			<label for="username" class="text-sm font-medium text-slate-700">Nombre de usuario</label>
			<input
				id="username"
				name="username"
				type="text"
				required
				minlength="3"
				maxlength="20"
				pattern="[a-zA-Z0-9_.\-]{'{3,20}'}"
				value={data.profile.username}
				class="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500"
			/>
			<p class="text-xs text-slate-500">
				3-20 caracteres. Solo letras, números, ".", "_" o "-". Debe ser único.
			</p>
		</div>

		<div class="space-y-2">
			<label for="name" class="text-sm font-medium text-slate-700">Nombre visible (opcional)</label>
			<input
				id="name"
				name="name"
				type="text"
				maxlength="60"
				value={data.profile.name}
				class="w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500"
			/>
			<p class="text-xs text-slate-500">Cómo querés que te muestren en los artículos.</p>
		</div>

		<div class="space-y-2">
			<div class="flex items-center justify-between gap-2">
				<label for="email" class="text-sm font-medium text-slate-700">Correo electrónico</label>
				{#if data.profile.emailVerified || data.profile.provider === 'google'}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/70 ring-inset"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-3 w-3"
							aria-hidden="true"
						>
							<path d="m9 12 2 2 4-4" />
							<circle cx="12" cy="12" r="10" />
						</svg>
						Correo verificado
					</span>
				{/if}
			</div>
			<input
				id="email"
				type="email"
				value={data.profile.email}
				disabled
				class="w-full cursor-not-allowed rounded-md border-slate-200 bg-slate-50 text-slate-500 shadow-sm"
			/>
			<p class="text-xs text-slate-500">
				{data.profile.provider === 'google'
					? 'Tu correo lo gestiona Google.'
					: 'El cambio de correo aún no está disponible.'}
			</p>
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
					Guardar cambios
				{/if}
			</button>
		</div>
	</form>

	{#if data.profile.provider === 'credentials' && !data.profile.emailVerified}
		<form
			method="POST"
			action="?/sendVerification"
			use:enhance={handleSendVerification}
			class="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
		>
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-start gap-3">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-500"
						aria-hidden="true"
					>
						<path
							d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
						/>
						<line x1="12" y1="9" x2="12" y2="13" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					</svg>
					<div>
						<p class="text-sm font-semibold text-amber-900">Tu correo aún no está verificado</p>
						<p class="mt-0.5 text-xs text-amber-800/90">
							Verificalo para poder recuperar tu contraseña si la olvidás. El código expira en 10
							minutos.
						</p>
					</div>
				</div>
				<button
					type="submit"
					disabled={isSendingVerification}
					class="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
				>
					{#if isSendingVerification}
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
						Enviando...
					{:else}
						Enviar código de verificación
					{/if}
				</button>
			</div>
		</form>
	{/if}
</section>

<AvatarCropper
	open={cropperOpen}
	file={cropperSource}
	onConfirm={onCropConfirm}
	onCancel={onCropCancel}
/>
