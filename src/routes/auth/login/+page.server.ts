import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { safeReturnTo } from '$lib/server/redirect';

const errorMessages: Record<string, string> = {
	invalid_link: 'El enlace de acceso no es válido. Solicitá uno nuevo.',
	expired_link: 'El enlace expiró. Solicitá uno nuevo.',
	used_link: 'Ese enlace ya se usó. Solicitá uno nuevo.',
	oauth_cancelled: 'Cancelaste el inicio de sesión con Google.'
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'), '/feed');

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
