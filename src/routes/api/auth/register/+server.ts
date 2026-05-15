import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createUser,
	EmailAlreadyRegisteredError,
	UsernameTakenError,
	USERNAME_REGEX
} from '$lib/server/auth';
import { createAndSendVerificationCode } from '$lib/server/verification';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rl = await checkRateLimit({
		key: `register:${getClientAddress()}`,
		limit: 3,
		windowMs: 5 * 60_000
	});
	if (!rl.ok) {
		throw error(429, `Demasiados intentos. Vuelve a intentarlo en ${rl.retryAfter}s.`);
	}

	let body: { email?: unknown; username?: unknown; password?: unknown; confirmPassword?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const username = typeof body.username === 'string' ? body.username.trim() : '';
	const password = typeof body.password === 'string' ? body.password : '';
	const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

	if (!email || !username || !password) throw error(400, 'Faltan datos');

	if (!USERNAME_REGEX.test(username)) {
		throw error(
			400,
			'El nombre de usuario debe tener 3-20 caracteres y solo letras, números, ".", "_" o "-".'
		);
	}

	if (password.length < 6) throw error(400, 'La contraseña debe tener al menos 6 caracteres');
	if (password !== confirmPassword) throw error(400, 'Las contraseñas no coinciden');

	try {
		await createUser(email, username, password);
	} catch (e) {
		if (e instanceof UsernameTakenError) throw error(400, e.message);
		if (!(e instanceof EmailAlreadyRegisteredError)) {
			console.error('Error en registro:', e);
			throw error(500, 'Error interno al registrarse');
		}
		// EmailAlreadyRegistered: silenciamos para no enumerar correos.
	}

	try {
		await createAndSendVerificationCode(email);
	} catch {
		// Silencioso — no revelamos si el correo existe.
	}

	return json({
		ok: true,
		redirectTo: `/auth/verify-email?email=${encodeURIComponent(email)}`
	});
};
