import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;

export const GET: RequestHandler = async ({ url }) => {
	if (!GOOGLE_CLIENT_ID) {
		console.error('GOOGLE_CLIENT_ID no está definido. Revisa tu archivo .env.');
		return new Response('Configuración de Google OAuth incompleta (GOOGLE_CLIENT_ID).', {
			status: 500
		});
	}

	const redirectUri = new URL('/auth/google/callback', url.origin).toString();

	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'offline',
		prompt: 'consent'
	});

	throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
