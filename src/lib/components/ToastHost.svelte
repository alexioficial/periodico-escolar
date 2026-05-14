<script lang="ts">
	import { toast, type Toast } from '$lib/toast';
	import { fly, fade } from 'svelte/transition';
	import { onDestroy } from 'svelte';

	let toasts = $state<Toast[]>([]);

	const unsubscribe = toast.subscribe((value) => {
		toasts = value;
	});

	onDestroy(unsubscribe);

	const variantClasses = (variant: Toast['variant']) => {
		if (variant === 'success') return 'border-emerald-300 bg-emerald-50 text-emerald-900';
		if (variant === 'error') return 'border-red-300 bg-red-50 text-red-900';
		if (variant === 'warning') return 'border-amber-300 bg-amber-50 text-amber-900';
		return 'border-sky-300 bg-sky-50 text-sky-900';
	};

	const iconColor = (variant: Toast['variant']) => {
		if (variant === 'success') return 'text-emerald-500';
		if (variant === 'error') return 'text-red-500';
		if (variant === 'warning') return 'text-amber-500';
		return 'text-sky-500';
	};

	const dismiss = (id: number) => toast.dismiss(id);
</script>

<!-- z-[70]: por encima de cualquier modal (z-60). Sin esto, un toast podía
quedar tapado por un dialog abierto al mismo tiempo. -->
<div
	class="pointer-events-none fixed inset-0 z-[70] flex items-start justify-end px-4 py-4"
	aria-live="polite"
	aria-atomic="false"
>
	<div class="flex w-full max-w-md flex-col gap-3">
		{#each toasts as t (t.id)}
			<div
				in:fly={{ x: 32, duration: 180 }}
				out:fade={{ duration: 150 }}
				role={t.variant === 'error' || t.variant === 'warning' ? 'alert' : 'status'}
				class={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl shadow-slate-900/15 ${variantClasses(t.variant)}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class={`mt-0.5 h-6 w-6 flex-shrink-0 ${iconColor(t.variant)}`}
					aria-hidden="true"
				>
					{#if t.variant === 'success'}
						<circle cx="12" cy="12" r="10" />
						<path d="m9 12 2 2 4-4" />
					{:else if t.variant === 'error'}
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					{:else if t.variant === 'warning'}
						<path
							d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
						/>
						<line x1="12" y1="9" x2="12" y2="13" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					{:else}
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="16" x2="12" y2="12" />
						<line x1="12" y1="8" x2="12.01" y2="8" />
					{/if}
				</svg>
				<div class="flex-1 text-sm">
					<div class="leading-snug font-semibold">{t.message}</div>
					{#if t.description}
						<div class="mt-0.5 text-xs leading-snug opacity-80">{t.description}</div>
					{/if}
				</div>
				<button
					type="button"
					class="ml-1 rounded-full px-2 text-xs font-medium opacity-60 transition hover:bg-black/5 hover:opacity-100"
					onclick={() => dismiss(t.id)}
				>
					Cerrar
				</button>
			</div>
		{/each}
	</div>
</div>
