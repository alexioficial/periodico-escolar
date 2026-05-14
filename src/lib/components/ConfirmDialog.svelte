<script lang="ts">
	import { confirmDialog } from '$lib/confirmDialog';
	import { fade, scale } from 'svelte/transition';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/scrollLock';

	const dialog = $derived($confirmDialog);

	const variantStyles = (variant: typeof dialog.variant) => {
		if (variant === 'danger')
			return {
				border: 'border-red-200',
				iconBg: 'bg-red-50',
				icon: 'text-red-600',
				confirmBtn: 'bg-red-600 hover:bg-red-700'
			};
		if (variant === 'warning')
			return {
				border: 'border-amber-200',
				iconBg: 'bg-amber-50',
				icon: 'text-amber-600',
				confirmBtn: 'bg-amber-600 hover:bg-amber-700'
			};
		return {
			border: 'border-blue-200',
			iconBg: 'bg-blue-50',
			icon: 'text-blue-600',
			confirmBtn: 'bg-blue-600 hover:bg-blue-700'
		};
	};

	const styles = $derived(variantStyles(dialog.variant));

	let confirmButton = $state<HTMLButtonElement | undefined>();

	// Manejo central: cuando se abre, lockeamos scroll y movemos el foco al
	// botón de confirmar. Cleanup automático al cerrar/desmontar.
	$effect(() => {
		if (!dialog.isOpen) return;
		lockBodyScroll();
		const previouslyFocused = document.activeElement as HTMLElement | null;
		// Pequeño delay para que el botón ya esté en el DOM tras la transición.
		const t = setTimeout(() => confirmButton?.focus(), 50);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') confirmDialog.handleCancel();
		};
		window.addEventListener('keydown', onKey);
		return () => {
			clearTimeout(t);
			window.removeEventListener('keydown', onKey);
			unlockBodyScroll();
			previouslyFocused?.focus?.();
		};
	});
</script>

{#if dialog.isOpen}
	<!-- Backdrop: botón nativo invisible para que clic/keyboard sean nativos y
	pase a11y; sin role="button" sobre un div con tabindex (anti-patrón). -->
	<button
		type="button"
		aria-label="Cerrar diálogo"
		onclick={confirmDialog.handleCancel}
		class="fixed inset-0 z-[60] cursor-default bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	></button>

	<div class="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
		<div
			class="pointer-events-auto relative w-full max-w-md rounded-2xl border {styles.border} bg-white shadow-2xl"
			transition:scale={{ duration: 200, start: 0.95 }}
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-dialog-title"
			aria-describedby="confirm-dialog-message"
			tabindex="-1"
		>
			<div class="flex items-start gap-4 border-b border-slate-200 p-6">
				<div
					class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full {styles.iconBg}"
				>
					{#if dialog.variant === 'danger'}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="h-6 w-6 {styles.icon}"
							aria-hidden="true"
						>
							<path
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					{:else if dialog.variant === 'warning'}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="h-6 w-6 {styles.icon}"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="h-6 w-6 {styles.icon}"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="16" x2="12" y2="12" />
							<line x1="12" y1="8" x2="12.01" y2="8" />
						</svg>
					{/if}
				</div>

				<div class="flex-1">
					<h3 id="confirm-dialog-title" class="text-lg font-semibold text-slate-900">
						{dialog.title}
					</h3>
				</div>
			</div>

			<div class="p-6">
				<p id="confirm-dialog-message" class="text-sm text-slate-600">
					{dialog.message}
				</p>
			</div>

			<div class="flex gap-3 border-t border-slate-200 p-6">
				<button
					type="button"
					onclick={confirmDialog.handleCancel}
					class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					{dialog.cancelText}
				</button>
				<button
					type="button"
					bind:this={confirmButton}
					onclick={confirmDialog.handleConfirm}
					class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors {styles.confirmBtn}"
				>
					{dialog.confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}
