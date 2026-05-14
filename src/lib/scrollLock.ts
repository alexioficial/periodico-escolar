/**
 * Scroll lock con contador: si varios modales abren simultáneamente, sólo se
 * libera el scroll cuando el último cierra. Sin esto, dos lockeos concurrentes
 * pueden dejar el body bloqueado o liberarlo demasiado pronto.
 */

let count = 0;
let originalOverflow = '';

export function lockBodyScroll() {
	if (typeof document === 'undefined') return;
	if (count === 0) {
		originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
	}
	count++;
}

export function unlockBodyScroll() {
	if (typeof document === 'undefined') return;
	if (count === 0) return;
	count--;
	if (count === 0) {
		document.body.style.overflow = originalOverflow;
	}
}
