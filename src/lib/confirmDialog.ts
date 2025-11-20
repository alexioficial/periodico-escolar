import { writable } from 'svelte/store';

interface ConfirmDialogOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmDialogState extends ConfirmDialogOptions {
    isOpen: boolean;
    resolve?: (value: boolean) => void;
}

function createConfirmDialog() {
    const { subscribe, update } = writable<ConfirmDialogState>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        variant: 'info'
    });

    function confirm(options: ConfirmDialogOptions): Promise<boolean> {
        return new Promise((resolve) => {
            update(() => ({
                ...options,
                confirmText: options.confirmText || 'Confirmar',
                cancelText: options.cancelText || 'Cancelar',
                variant: options.variant || 'info',
                isOpen: true,
                resolve
            }));
        });
    }

    function handleConfirm() {
        update((state) => {
            state.resolve?.(true);
            return { ...state, isOpen: false };
        });
    }

    function handleCancel() {
        update((state) => {
            state.resolve?.(false);
            return { ...state, isOpen: false };
        });
    }

    return {
        subscribe,
        confirm,
        handleConfirm,
        handleCancel
    };
}

export const confirmDialog = createConfirmDialog();
