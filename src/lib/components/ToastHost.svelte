<script lang="ts">
	import { toast, type Toast } from '$lib/toast';
	import { fly, fade } from 'svelte/transition';

	let toasts: Toast[] = [];

	const unsubscribe = toast.subscribe((value) => {
		toasts = value;
	});

	$: if (toasts.length === 0) {
		// no-op, just to ensure reactivity
	}

	const variantClasses = (variant: Toast['variant']) => {
		if (variant === 'success') return 'border-emerald-300 bg-emerald-50 text-emerald-900';
		if (variant === 'error') return 'border-red-300 bg-red-50 text-red-900';
		if (variant === 'warning') return 'border-amber-300 bg-amber-50 text-amber-900';
		return 'border-sky-300 bg-sky-50 text-sky-900';
	};

	const iconClass = (variant: Toast['variant']) => {
		if (variant === 'success') return 'i-[mdi--check-circle] text-emerald-500';
		if (variant === 'error') return 'i-[mdi--alert-circle] text-red-500';
		if (variant === 'warning') return 'i-[mdi--alert] text-amber-500';
		return 'i-[mdi--information] text-sky-500';
	};

	const dismiss = (id: number) => toast.dismiss(id);

	// Cleanup on destroy
	import { onDestroy } from 'svelte';
	onDestroy(unsubscribe);
</script>

<div class="pointer-events-none fixed inset-0 z-50 flex items-start justify-end px-4 py-4">
	<div class="flex w-full max-w-sm flex-col gap-3">
		{#each toasts as t (t.id)}
			<div
				in:fly={{ x: 32, duration: 180 }}
				out:fade={{ duration: 150 }}
				class={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2 shadow-lg shadow-slate-900/10 ${variantClasses(t.variant)}`}
			>
				<div class={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconClass(t.variant)}`}></div>
				<div class="flex-1 text-xs">
					<div class="leading-snug font-semibold">{t.message}</div>
					{#if t.description}
						<div class="mt-0.5 text-[11px] leading-snug opacity-80">{t.description}</div>
					{/if}
				</div>
				<button
					type="button"
					class="ml-1 rounded-full px-1.5 text-[10px] font-medium opacity-60 transition hover:bg-black/5 hover:opacity-100"
					on:click={() => dismiss(t.id)}
				>
					Cerrar
				</button>
			</div>
		{/each}
	</div>
</div>
