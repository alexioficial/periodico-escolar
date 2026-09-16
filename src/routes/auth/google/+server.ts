import crypto from 'crypto';
import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeReturnTo } from '$lib/server/redirect';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!env.GOOGLE_CLIENT_ID) throw error(500, 'Configuración de Google OAuth incompleta.');

	const state = crypto.randomBytes(32).toString('hex');
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'), '/feed');
	const cookieOptions = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge: 5 * 60
	};
	cookies.set('oauth_state', state, cookieOptions);
	cookies.set('oauth_returnTo', returnTo, cookieOptions);

	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: new URL('/auth/google/callback', url.origin).toString(),
		response_type: 'code',
		scope: 'openid email profile',
		state
	});
	throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
