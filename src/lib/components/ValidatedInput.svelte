<script lang="ts">
	import { fade } from 'svelte/transition';

	interface Props {
		type?: string;
		name?: string;
		id?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		value?: string | number;
		variant?: 'default' | 'danger' | 'success' | 'info' | 'warning';
		message?: string;
		class?: string;

		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
		onblur?: (e: Event) => void;
		onfocus?: (e: Event) => void;
	}

	let {
		type = 'text',
		name,
		id,
		placeholder,
		required = false,
		disabled = false,
		value = $bindable(''),
		variant = 'default',
		message,
		class: customClass = '',
		oninput,
		onchange,
		onblur,
		onfocus
	}: Props = $props();

	let showTooltip = $state(false);
	let isFocused = $state(false);

	const variantClasses = {
		default: 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500',
		danger: 'border-red-500 focus:border-red-500 focus:ring-red-500',
		success: 'border-green-500 focus:border-green-500 focus:ring-green-500',
		info: 'border-blue-500 focus:border-blue-500 focus:ring-blue-500',
		warning: 'border-amber-500 focus:border-amber-500 focus:ring-amber-500'
	};

	const tooltipBgColors = {
		default: 'bg-slate-700',
		danger: 'bg-red-600',
		success: 'bg-green-600',
		info: 'bg-blue-600',
		warning: 'bg-amber-600'
	};

	function handleFocus(e: Event) {
		isFocused = true;
		if (message) showTooltip = true;
		onfocus?.(e);
	}

	function handleBlur(e: Event) {
		isFocused = false;
		showTooltip = false;
		onblur?.(e);
	}

	function handleMouseEnter() {
		if (message && !isFocused) {
			showTooltip = true;
		}
	}

	function handleMouseLeave() {
		if (!isFocused) {
			showTooltip = false;
		}
	}
</script>

<div class="relative w-full">
	<input
		{type}
		{name}
		{id}
		{placeholder}
		{required}
		{disabled}
		bind:value
		{oninput}
		{onchange}
		onfocus={handleFocus}
		onblur={handleBlur}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		class="w-full rounded-lg border px-4 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 {variantClasses[
			variant
		]} {customClass}"
	/>

	{#if showTooltip && message}
		<div
			transition:fade={{ duration: 150 }}
			class="absolute top-full left-0 z-10 mt-1 max-w-xs rounded-lg px-3 py-2 text-xs text-white shadow-lg {tooltipBgColors[
				variant
			]}"
			role="tooltip"
		>
			{message}
			<!-- Arrow -->
			<div
				class="absolute top-0 left-4 h-2 w-2 -translate-y-1 rotate-45 transform {tooltipBgColors[
					variant
				]}"
			></div>
		</div>
	{/if}
</div>
