import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { safeReturnTo } from '$lib/server/redirect';

const errorMessages: Record<string, string> = {
	invalid_link: 'El enlace de acceso no es válido. Solicita uno nuevo.',
	expired_link: 'El enlace expiró. Solicita uno nuevo.',
	used_link: 'Ese enlace ya se usó. Solicita uno nuevo.',
	oauth_cancelled: 'Cancelaste el inicio de sesión con Google.',
	csrf: 'La sesión de Google expiró o fue manipulada. Inténtalo de nuevo.',
	institutional_email_required: 'Se requiere un correo institucional @salesianos.edu.do'
};

export const load: PageServerLoad = ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'), '/feed');
	if (locals.user) throw redirect(303, returnTo);

	const errorCode = url.searchParams.get('error');
	return {
		returnTo,
		errorMessage: errorCode ? (errorMessages[errorCode] ?? null) : null
	};
};
