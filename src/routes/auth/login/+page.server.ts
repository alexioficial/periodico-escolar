import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import {
	createQaAuthGrant,
	isQaAuthBypassAuthorized,
	isQaAuthGrantAuthorized,
	QA_AUTH_GRANT_COOKIE
} from '$lib/server/qaAuthBypass';
import { loginPath, safeReturnTo } from '$lib/server/redirect';
import { deleteSession } from '$lib/server/session';

const errorMessages: Record<string, string> = {
	invalid_link: 'El enlace de acceso no es válido. Solicitá uno nuevo.',
	expired_link: 'El enlace expiró. Solicitá uno nuevo.',
	used_link: 'Ese enlace ya se usó. Solicitá uno nuevo.',
	oauth_cancelled: 'Cancelaste el inicio de sesión con Google.'
};

export const load: PageServerLoad = async ({ locals, url, cookies, setHeaders }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'), '/feed');

	const providedSecret = url.searchParams.get('qa');
	if (providedSecret !== null) {
		setHeaders({
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer'
		});
		const grant = createQaAuthGrant({
			enabled: env.QA_AUTH_BYPASS_ENABLED,
			configuredSecret: env.QA_AUTH_BYPASS_SECRET
		});
		if (
			grant &&
			isQaAuthBypassAuthorized({
				enabled: env.QA_AUTH_BYPASS_ENABLED,
				configuredSecret: env.QA_AUTH_BYPASS_SECRET,
				providedSecret
			})
		) {
			const currentSession = cookies.get('session');
			if (currentSession) await deleteSession(currentSession);
			cookies.delete('session', { path: '/' });
			cookies.set(QA_AUTH_GRANT_COOKIE, grant, {
				path: '/auth',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 5 * 60
			});
		} else {
			cookies.delete(QA_AUTH_GRANT_COOKIE, { path: '/auth' });
		}
		throw redirect(303, loginPath(returnTo));
	}

	if (locals.user) {
		throw redirect(303, returnTo);
	}

	const qaGrant = cookies.get(QA_AUTH_GRANT_COOKIE);
	const qaBypassEnabled = isQaAuthGrantAuthorized({
		enabled: env.QA_AUTH_BYPASS_ENABLED,
		configuredSecret: env.QA_AUTH_BYPASS_SECRET,
		grant: qaGrant
	});
	if (qaGrant && !qaBypassEnabled) {
		cookies.delete(QA_AUTH_GRANT_COOKIE, { path: '/auth' });
	}

	const errCode = url.searchParams.get('error');
	return {
		csrfError: errCode === 'csrf',
		linkError: errCode && errorMessages[errCode] ? errorMessages[errCode] : null,
		returnTo,
		qaBypassEnabled
	};
};
