import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!GOOGLE_CLIENT_ID) {
		console.error('GOOGLE_CLIENT_ID no está definido. Revisa tu archivo .env.');
		return new Response('Configuración de Google OAuth incompleta (GOOGLE_CLIENT_ID).', {
			status: 500
		});
	}

	const redirectUri = new URL('/auth/google/callback', url.origin).toString();
	const state = crypto.randomBytes(32).toString('hex');

	cookies.set('oauth_state', state, {
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
