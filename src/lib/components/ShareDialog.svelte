<script lang="ts">
	import { shareDialog } from '$lib/shareDialog';
	import { toast } from '$lib/toast';
	import { fade, scale } from 'svelte/transition';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/scrollLock';

	const dialog = $derived($shareDialog);

	let copied = $state(false);
	let urlInput = $state<HTMLInputElement | undefined>();

	const shareTitle = $derived(dialog.title || 'Periódico escolar');

	const targets = $derived([
		{
			name: 'WhatsApp',
			color: 'bg-[#25D366]',
			href: `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${dialog.url}`)}`,
			icon: 'M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.043zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z'
		},
		{
			name: 'Telegram',
			color: 'bg-[#229ED9]',
			href: `https://t.me/share/url?url=${encodeURIComponent(dialog.url)}&text=${encodeURIComponent(shareTitle)}`,
			icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z'
		},
		{
			name: 'Facebook',
			color: 'bg-[#1877F2]',
			href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(dialog.url)}`,
			icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
		},
		{
			name: 'X',
			color: 'bg-black',
			href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(dialog.url)}&text=${encodeURIComponent(shareTitle)}`,
			icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
		},
		{
			name: 'Correo',
			color: 'bg-slate-600',
			href: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(dialog.url)}`,
			icon: 'M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z'
		}
	]);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(dialog.url);
			copied = true;
			toast.success('Enlace copiado al portapapeles');
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Fallback: seleccionar el texto para copia manual.
			urlInput?.select();
			toast.info('Copiá el enlace manualmente');
		}
	}

	// Instagram no expone un endpoint web para compartir un enlace (no hay
	// "sharer" como en WhatsApp/Telegram). Lo usual: copiar el enlace y abrir
	// Instagram para pegarlo en historia/bio/DM.
	async function shareInstagram() {
		try {
			await navigator.clipboard.writeText(dialog.url);
			toast.info('Enlace copiado', 'Pegalo en tu historia, bio o mensaje de Instagram');
		} catch {
			toast.info('Copiá el enlace y pegalo en Instagram');
		}
		window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
	}

	const canNativeShare = $derived(
		typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);

	async function nativeShare() {
		try {
			await navigator.share({ title: shareTitle, url: dialog.url });
			shareDialog.close();
		} catch {
			/* el usuario canceló: no hacemos nada */
		}
	}

	// Lock de scroll + cierre con Escape mientras está abierto.
	$effect(() => {
		if (!dialog.isOpen) return;
		lockBodyScroll();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') shareDialog.close();
		};
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('keydown', onKey);
			unlockBodyScroll();
		};
	});
</script>

{#if dialog.isOpen}
	<button
		type="button"
		aria-label="Cerrar"
		onclick={() => shareDialog.close()}
		class="fixed inset-0 z-[60] cursor-default bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	></button>

	<div class="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
		<div
			class="pointer-events-auto relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl"
			transition:scale={{ duration: 200, start: 0.95 }}
			role="dialog"
			aria-modal="true"
			aria-labelledby="share-dialog-title"
		>
			<div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
				<h3 id="share-dialog-title" class="text-base font-semibold text-slate-900">Compartir</h3>
				<button
					type="button"
					onclick={() => shareDialog.close()}
					aria-label="Cerrar"
					class="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-5 w-5"
						aria-hidden="true"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div class="space-y-5 p-5">
				<div class="flex flex-wrap justify-center gap-4">
					{#each targets as t (t.name)}
						<a
							href={t.href}
							target="_blank"
							rel="noopener noreferrer"
							class="flex w-16 flex-col items-center gap-1.5 text-center"
						>
							<span
								class={`flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform hover:scale-105 ${t.color}`}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="h-6 w-6"
									aria-hidden="true"
								>
									<path d={t.icon} />
								</svg>
							</span>
							<span class="text-xs text-slate-600">{t.name}</span>
						</a>
					{/each}
					<button
						type="button"
						onclick={shareInstagram}
						class="flex w-16 flex-col items-center gap-1.5 text-center"
					>
						<span
							class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#7024C4] via-[#C21975] to-[#FEC053] text-white transition-transform hover:scale-105"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-6 w-6"
								aria-hidden="true"
							>
								<path
									d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56-.79.3-1.46.71-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.63-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.3.79.71 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"
								/>
							</svg>
						</span>
						<span class="text-xs text-slate-600">Instagram</span>
					</button>
					{#if canNativeShare}
						<button
							type="button"
							onclick={nativeShare}
							class="flex w-16 flex-col items-center gap-1.5 text-center"
						>
							<span
								class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 text-white transition-transform hover:scale-105"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="h-6 w-6"
									aria-hidden="true"
								>
									<circle cx="18" cy="5" r="3" />
									<circle cx="6" cy="12" r="3" />
									<circle cx="18" cy="19" r="3" />
									<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
									<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
								</svg>
							</span>
							<span class="text-xs text-slate-600">Más</span>
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
					<input
						bind:this={urlInput}
						type="text"
						readonly
						value={dialog.url}
						onfocus={(e) => e.currentTarget.select()}
						class="min-w-0 flex-1 truncate bg-transparent px-2 text-sm text-slate-600 outline-none"
						aria-label="Enlace para compartir"
					/>
					<button
						type="button"
						onclick={copyLink}
						class="flex-shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
					>
						{copied ? 'Copiado' : 'Copiar'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
