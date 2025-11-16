import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { findOrCreateUserFromGoogle } from '$lib/server/auth';
import { createSession } from '$lib/server/session';
import { env } from '$env/dynamic/private';

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;

export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	// Si el usuario canceló o hubo un error en Google, redirigir al login
	if (!code || error) {
		throw redirect(303, '/auth/login');
	}

	if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
		console.error('GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no configurados. Revisa tu .env');
		return new Response('Configuración de Google OAuth incompleta (client id/secret).', {
			status: 500
		});
	}

	const redirectUri = new URL('/auth/google/callback', url.origin).toString();

	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			code,
			client_id: GOOGLE_CLIENT_ID,
			client_secret: GOOGLE_CLIENT_SECRET,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});

	if (!tokenRes.ok) {
		const text = await tokenRes.text();
		console.error('Error al obtener token de Google:', text);
		return new Response('Error al obtener token de Google', { status: 500 });
	}

	const tokenJson = (await tokenRes.json()) as {
		access_token?: string;
		id_token?: string;
	};

	if (!tokenJson.access_token) {
		return new Response('No se recibió access_token de Google', { status: 500 });
	}

	const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		headers: {
			Authorization: `Bearer ${tokenJson.access_token}`
		}
	});

	if (!userRes.ok) {
		const text = await userRes.text();
		console.error('Error al obtener usuario de Google:', text);
		return new Response('Error al obtener usuario de Google', { status: 500 });
	}

	const profile = (await userRes.json()) as {
		sub: string;
		email: string;
		name?: string;
		picture?: string;
		email_verified?: boolean;
	};

	if (!profile.email) {
		return new Response('Google no devolvió un email válido', { status: 500 });
	}

	const user = await findOrCreateUserFromGoogle(profile);
	if (!user) {
		return new Response('No se pudo crear o encontrar el usuario de Google', { status: 500 });
	}

	const token = await createSession(user._id);
	const secure = process.env.NODE_ENV === 'production';

	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: 60 * 60 * 24 * 7
	});

	throw redirect(303, '/redaccion');
};
