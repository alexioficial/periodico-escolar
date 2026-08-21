import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';
import { safeReturnTo } from '$lib/server/redirect';

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!GOOGLE_CLIENT_ID) {
		console.error('GOOGLE_CLIENT_ID no está definido. Revisa tu archivo .env.');
		throw error(500, 'Configuración de Google OAuth incompleta.');
	}

	const redirectUri = new URL('/auth/google/callback', url.origin).toString();
	const state = crypto.randomBytes(32).toString('hex');
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'), '/redaccion');

	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 5 * 60
	});
	cookies.set('oauth_returnTo', returnTo, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 5 * 60
	});

	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'offline',
		prompt: 'consent',
		state
	});

	throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
