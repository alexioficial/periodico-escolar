import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { consumeMagicLink } from '$lib/server/magicLink';
import { findOrCreateUserByEmail } from '$lib/server/auth';
import { createSession } from '$lib/server/session';
import { checkRateLimit } from '$lib/server/rateLimit';
import { safeReturnTo } from '$lib/server/redirect';

const TOKEN_REGEX = /^[a-f0-9]{64}$/;

export const load: PageServerLoad = ({ params }) => {
	if (!TOKEN_REGEX.test(params.token)) {
		throw redirect(303, '/auth/login?error=invalid_link');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ params, cookies, getClientAddress }) => {
		const rateLimit = await checkRateLimit({
			key: `magic-consume:${getClientAddress()}`,
			limit: 20,
			windowMs: 5 * 60_000,
			onError: 'closed'
		});
		if (!rateLimit.ok) {
			throw error(429, 'Demasiados intentos. Probá más tarde.');
		}

		const result = await consumeMagicLink(params.token);
		if (!result.ok) {
			const code =
				result.reason === 'expired'
					? 'expired_link'
					: result.reason === 'used'
						? 'used_link'
						: 'invalid_link';
			throw redirect(303, `/auth/login?error=${code}`);
		}

		let user;
		try {
			user = await findOrCreateUserByEmail(result.email);
		} catch (cause) {
			console.error('Error al materializar usuario tras magic-link:', cause);
			throw error(500, 'No se pudo iniciar sesión');
		}
		if (!user) throw error(500, 'No se pudo iniciar sesión');

		const token = await createSession(user._id);
		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7
		});

		throw redirect(303, safeReturnTo(result.returnTo, '/feed'));
	}
};
