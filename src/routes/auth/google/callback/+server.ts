import type { RequestHandler } from '@sveltejs/kit';
import { redirect, error as svelteError } from '@sveltejs/kit';
import { findOrCreateUserFromGoogle, EmailAccountConflictError } from '$lib/server/auth';
import { createSession } from '$lib/server/session';
import { env } from '$env/dynamic/private';

const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;

function safeReturnTo(raw: string | null | undefined): string {
	if (typeof raw !== 'string' || !raw) return '/redaccion';
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/redaccion';
	return raw;
}

export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
	const code = url.searchParams.get('code');
	const oauthErr = url.searchParams.get('error');
	const state = url.searchParams.get('state');

	const storedReturnTo = safeReturnTo(cookies.get('oauth_returnTo'));
	cookies.delete('oauth_returnTo', { path: '/' });

	if (!code || oauthErr) {
		// Cuando el usuario cancela el consentimiento Google manda ?error=...
		throw redirect(303, '/auth/login?error=oauth_cancelled');
	}

	const storedState = cookies.get('oauth_state');
	cookies.delete('oauth_state', { path: '/' });

	if (!storedState || !state || storedState !== state) {
		console.error('OAuth state mismatch — posible CSRF');
		throw redirect(303, '/auth/login?error=csrf');
	}

	if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
		console.error('GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no configurados. Revisa tu .env');
		throw svelteError(500, 'Configuración de Google OAuth incompleta.');
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
		throw svelteError(502, 'Error al obtener token de Google. Intenta de nuevo.');
	}

	const tokenJson = (await tokenRes.json()) as {
		access_token?: string;
		id_token?: string;
	};

	if (!tokenJson.access_token) {
		throw svelteError(502, 'No se recibió access_token de Google.');
	}

	const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		headers: {
			Authorization: `Bearer ${tokenJson.access_token}`
		}
	});

	if (!userRes.ok) {
		const text = await userRes.text();
		console.error('Error al obtener usuario de Google:', text);
		throw svelteError(502, 'Error al obtener tus datos de Google.');
	}

	const profile = (await userRes.json()) as {
		sub: string;
		email: string;
		name?: string;
		picture?: string;
		email_verified?: boolean;
	};

	if (!profile.email) {
		throw svelteError(502, 'Google no devolvió un email válido.');
	}

	let user;
	try {
		user = await findOrCreateUserFromGoogle(profile);
	} catch (err) {
		if (err instanceof EmailAccountConflictError) {
			throw redirect(303, '/auth/login?error=account_conflict');
		}
		throw err;
	}
	if (!user) {
		throw svelteError(500, 'No se pudo crear o encontrar el usuario de Google.');
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

	throw redirect(303, storedReturnTo);
};
