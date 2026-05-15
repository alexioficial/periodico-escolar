import { writable } from 'svelte/store';

interface ShareDialogOptions {
	url: string;
	title?: string;
}

interface ShareDialogState extends ShareDialogOptions {
	isOpen: boolean;
}

function createShareDialog() {
	const { subscribe, update, set } = writable<ShareDialogState>({
		isOpen: false,
		url: '',
		title: ''
	});

	function open(options: ShareDialogOptions) {
		set({
			url: options.url,
			title: options.title || '',
			isOpen: true
		});
	}

	function close() {
		update((state) => ({ ...state, isOpen: false }));
	}

	return { subscribe, open, close };
}

export const shareDialog = createShareDialog();
