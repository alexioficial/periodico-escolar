import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findOrCreateUserByEmail } from '$lib/server/auth';
import {
	getQaAuthVersion,
	isQaAuthGrantAuthorized,
	normalizeQaAuthBypassEmail,
	QA_AUTH_GRANT_COOKIE
} from '$lib/server/qaAuthBypass';
import { checkRateLimit } from '$lib/server/rateLimit';
import { safeReturnTo } from '$lib/server/redirect';
import { createSession } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const rateLimit = await checkRateLimit({
		key: `qa-login:${getClientAddress()}`,
		limit: 30,
		windowMs: 5 * 60_000,
		onError: 'closed'
	});
	if (!rateLimit.ok) {
		throw error(429, 'Demasiados intentos. Probá más tarde.');
	}

	const grant = cookies.get(QA_AUTH_GRANT_COOKIE);
	if (
		!isQaAuthGrantAuthorized({
			enabled: env.QA_AUTH_BYPASS_ENABLED,
			configuredSecret: env.QA_AUTH_BYPASS_SECRET,
			grant
		})
	) {
		cookies.delete(QA_AUTH_GRANT_COOKIE, { path: '/auth' });
		throw error(404, 'No encontrado');
	}

	let body: { email?: unknown; returnTo?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const email = normalizeQaAuthBypassEmail(body.email);
	if (!email) throw error(400, 'Correo inválido');

	const user = await findOrCreateUserByEmail(email, 'qa-bypass');
	if (!user) throw error(500, 'No se pudo iniciar sesión');
	const qaAuthVersion = getQaAuthVersion(env.QA_AUTH_BYPASS_SECRET);
	if (!qaAuthVersion) throw error(404, 'No encontrado');

	const token = await createSession(user._id, { qaAuthVersion });
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 7
	});
	cookies.delete(QA_AUTH_GRANT_COOKIE, { path: '/auth' });

	return json(
		{ ok: true, redirectTo: safeReturnTo(body.returnTo, '/feed') },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
