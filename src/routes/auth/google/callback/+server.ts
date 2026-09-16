import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findOrCreateUserFromGoogle } from '$lib/server/auth';
import { InstitutionalEmailRequiredError } from '$lib/server/authEmailPolicy';
import { safeReturnTo } from '$lib/server/redirect';
import { createSession } from '$lib/server/session';

export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
	const code = url.searchParams.get('code');
	const oauthError = url.searchParams.get('error');
	const state = url.searchParams.get('state');
	const returnTo = safeReturnTo(cookies.get('oauth_returnTo'), '/feed');
	const storedState = cookies.get('oauth_state');
	cookies.delete('oauth_returnTo', { path: '/' });
	cookies.delete('oauth_state', { path: '/' });

	if (!code || oauthError) throw redirect(303, '/login?error=oauth_cancelled');
	if (!storedState || !state || storedState !== state) throw redirect(303, '/login?error=csrf');
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
		throw error(500, 'Configuración de Google OAuth incompleta.');
	}

	const redirectUri = new URL('/auth/google/callback', url.origin).toString();
	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});
	if (!tokenResponse.ok) throw error(502, 'Error al obtener token de Google.');
	const token = (await tokenResponse.json()) as { access_token?: string };
	if (!token.access_token) throw error(502, 'No se recibió access_token de Google.');

	const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		headers: { Authorization: `Bearer ${token.access_token}` }
	});
	if (!profileResponse.ok) throw error(502, 'Error al obtener tus datos de Google.');
	const profile = (await profileResponse.json()) as {
		sub: string;
		email: string;
		name?: string;
		picture?: string;
		email_verified?: boolean;
	};
	if (!profile.email || profile.email_verified !== true) {
		throw error(502, 'Google no devolvió un correo verificado.');
	}

	let user;
	try {
		user = await findOrCreateUserFromGoogle(profile);
	} catch (cause) {
		if (cause instanceof InstitutionalEmailRequiredError) {
			throw redirect(303, '/login?error=institutional_email_required');
		}
		throw cause;
	}
	if (!user) throw error(500, 'No se pudo crear o encontrar el usuario de Google.');

	const session = await createSession(user._id);
	cookies.set('session', session, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 7
	});
	throw redirect(303, returnTo);
};
