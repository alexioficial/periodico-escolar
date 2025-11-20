<script lang="ts">
	import { confirmDialog } from '$lib/confirmDialog';
	import { fade, scale } from 'svelte/transition';

	let dialog = $state($confirmDialog);

	$effect(() => {
		dialog = $confirmDialog;
	});

	const variantStyles = (variant: typeof dialog.variant) => {
		if (variant === 'danger')
			return {
				bg: 'bg-red-50',
				border: 'border-red-200',
				icon: 'text-red-600',
				confirmBtn: 'bg-red-600 hover:bg-red-700'
			};
		if (variant === 'warning')
			return {
				bg: 'bg-amber-50',
				border: 'border-amber-200',
				icon: 'text-amber-600',
				confirmBtn: 'bg-amber-600 hover:bg-amber-700'
			};
		return {
			bg: 'bg-blue-50',
			border: 'border-blue-200',
			icon: 'text-blue-600',
			confirmBtn: 'bg-blue-600 hover:bg-blue-700'
		};
	};

	const styles = $derived(variantStyles(dialog.variant));
</script>

{#if dialog.isOpen}
	<!-- Overlay -->
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
		onclick={confirmDialog.handleCancel}
		role="button"
		tabindex="-1"
	></div>

	<!-- Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="relative w-full max-w-md rounded-2xl border {styles.border} {styles.bg} bg-white shadow-2xl"
			transition:scale={{ duration: 200, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Header -->
			<div class="flex items-start gap-4 border-b border-slate-200 p-6">
				<!-- Icon -->
				<div
					class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full {styles.bg}"
				>
					{#if dialog.variant === 'danger'}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="h-6 w-6 {styles.icon}"
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
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="16" x2="12" y2="12" />
							<line x1="12" y1="8" x2="12.01" y2="8" />
						</svg>
					{/if}
				</div>

				<!-- Title -->
				<div class="flex-1">
					<h3 class="text-lg font-semibold text-slate-900">
						{dialog.title}
					</h3>
				</div>
			</div>

			<!-- Content -->
			<div class="p-6">
				<p class="text-sm text-slate-600">
					{dialog.message}
				</p>
			</div>

			<!-- Actions -->
			<div class="flex gap-3 border-t border-slate-200 p-6">
				<button
					onclick={confirmDialog.handleCancel}
					class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					{dialog.cancelText}
				</button>
				<button
					onclick={confirmDialog.handleConfirm}
					class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors {styles.confirmBtn}"
				>
					{dialog.confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}
