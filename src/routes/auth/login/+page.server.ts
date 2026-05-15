import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function safeReturnTo(raw: string | null): string {
	if (typeof raw !== 'string' || !raw) return '/feed';
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/feed';
	return raw;
}

const errorMessages: Record<string, string> = {
	invalid_link: 'El enlace de acceso no es válido. Solicitá uno nuevo.',
	expired_link: 'El enlace expiró. Solicitá uno nuevo.',
	used_link: 'Ese enlace ya se usó. Solicitá uno nuevo.',
	oauth_cancelled: 'Cancelaste el inicio de sesión con Google.'
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));

	if (locals.user) {
		throw redirect(303, returnTo);
	}

	const errCode = url.searchParams.get('error');
	return {
		csrfError: errCode === 'csrf',
		linkError: errCode && errorMessages[errCode] ? errorMessages[errCode] : null,
		returnTo
	};
};
