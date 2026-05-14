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
const MAX_VISIBLE = 5;

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let counter = 0;
	// Cancelables: dismiss manual debe limpiar el timer para no llamar dismiss
	// dos veces (no-op pero gasta closures) y para que `clear()` libere todo.
	const timers = new Map<number, ReturnType<typeof setTimeout>>();

	function add(message: string, options: Partial<Omit<Toast, 'id' | 'message'>> = {}) {
		const id = ++counter;
		const toast: Toast = {
			id,
			message,
			variant: options.variant ?? 'info',
			description: options.description,
			duration: options.duration ?? DEFAULT_DURATION
		};

		update((current) => {
			// Limitamos a N visibles: si llegamos al tope, descartamos el más
			// viejo para evitar saturar la pantalla con un loop accidental.
			const next = [...current, toast];
			while (next.length > MAX_VISIBLE) {
				const dropped = next.shift();
				if (dropped) {
					const timer = timers.get(dropped.id);
					if (timer) {
						clearTimeout(timer);
						timers.delete(dropped.id);
					}
				}
			}
			return next;
		});

		if (toast.duration && toast.duration > 0) {
			const timer = setTimeout(() => dismiss(id), toast.duration);
			timers.set(id, timer);
		}

		return id;
	}

	function dismiss(id: number) {
		const timer = timers.get(id);
		if (timer) {
			clearTimeout(timer);
			timers.delete(id);
		}
		update((current) => current.filter((t) => t.id !== id));
	}

	function clear() {
		for (const timer of timers.values()) clearTimeout(timer);
		timers.clear();
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
