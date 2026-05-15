import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateUser } from '$lib/server/auth';
import { createSession } from '$lib/server/session';
import { checkRateLimit } from '$lib/server/rateLimit';

function safeReturnTo(raw: unknown): string {
	if (typeof raw !== 'string' || !raw) return '/redaccion';
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/redaccion';
	return raw;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const rl = await checkRateLimit({
		key: `login:${getClientAddress()}`,
		limit: 5,
		windowMs: 5 * 60_000,
		onError: 'closed'
	});
	if (!rl.ok) {
		throw error(429, `Demasiados intentos. Vuelve a intentarlo en ${rl.retryAfter}s.`);
	}

	let body: { email?: unknown; password?: unknown; returnTo?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = typeof body.password === 'string' ? body.password : '';
	const returnTo = safeReturnTo(body.returnTo);

	if (!email || !password) throw error(400, 'Faltan datos');

	let user;
	try {
		user = await validateUser(email, password);
	} catch (e) {
		console.error('Error en login:', e);
		throw error(500, 'Error interno al iniciar sesión');
	}

	if (!user) throw error(401, 'Correo o contraseña incorrectos');

	if (user.provider === 'credentials' && user.emailVerified === false) {
		throw error(
			403,
			'Tu correo no está verificado. Revisa tu bandeja o solicita un nuevo código en /auth/verify-email.'
		);
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

	return json({ ok: true, redirectTo: returnTo });
};
