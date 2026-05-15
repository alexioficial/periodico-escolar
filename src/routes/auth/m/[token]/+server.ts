import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { consumeMagicLink } from '$lib/server/magicLink';
import { findOrCreateUserByEmail } from '$lib/server/auth';
import { createSession } from '$lib/server/session';
import { checkRateLimit } from '$lib/server/rateLimit';

export const GET: RequestHandler = async ({ params, cookies, getClientAddress }) => {
	const rl = await checkRateLimit({
		key: `magic-consume:${getClientAddress()}`,
		limit: 20,
		windowMs: 5 * 60_000,
		onError: 'closed'
	});
	if (!rl.ok) {
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
	} catch (e) {
		console.error('Error al materializar usuario tras magic-link:', e);
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

	throw redirect(303, result.returnTo || '/feed');
};
