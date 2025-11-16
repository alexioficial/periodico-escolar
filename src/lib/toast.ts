import { writable } from 'svelte/store';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
	id: number;
	message: string;
	description?: string;
	variant: ToastVariant;
	duration?: number;
}

const DEFAULT_DURATION = 4000;

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let counter = 0;

	function add(message: string, options: Partial<Omit<Toast, 'id' | 'message'>> = {}) {
		const id = ++counter;
		const toast: Toast = {
			id,
			message,
			variant: options.variant ?? 'info',
			description: options.description,
			duration: options.duration ?? DEFAULT_DURATION
		};

		update((current) => [...current, toast]);

		if (toast.duration && toast.duration > 0) {
			setTimeout(() => dismiss(id), toast.duration);
		}

		return id;
	}

	function dismiss(id: number) {
		update((current) => current.filter((t) => t.id !== id));
	}

	function clear() {
		update(() => []);
	}

	function success(message: string, description?: string, duration?: number) {
		return add(message, { variant: 'success', description, duration });
	}

	function error(message: string, description?: string, duration?: number) {
		return add(message, { variant: 'error', description, duration });
	}

	function info(message: string, description?: string, duration?: number) {
		return add(message, { variant: 'info', description, duration });
	}

	function warning(message: string, description?: string, duration?: number) {
		return add(message, { variant: 'warning', description, duration });
	}

	return {
		subscribe,
		add,
		dismiss,
		clear,
		success,
		error,
		info,
		warning
	};
}

export const toast = createToastStore();
