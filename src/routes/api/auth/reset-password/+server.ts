import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyResetCode } from '$lib/server/passwordReset';
import { checkRateLimit } from '$lib/server/rateLimit';

const reasonMessage = {
	not_found: 'Código inválido o expirado. Solicita uno nuevo.',
	expired: 'Código inválido o expirado. Solicita uno nuevo.',
	too_many_attempts: 'Demasiados intentos. Solicita un nuevo código.',
	invalid_code: 'Código inválido o expirado. Solicita uno nuevo.',
	invalid_password: 'La contraseña debe tener entre 8 y 128 caracteres.'
} as const;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rl = await checkRateLimit({
		key: `reset:${getClientAddress()}`,
		limit: 10,
		windowMs: 5 * 60_000
	});
	if (!rl.ok) {
		throw error(429, `Demasiados intentos. Vuelve a intentarlo en ${rl.retryAfter}s.`);
	}

	let body: { email?: unknown; code?: unknown; password?: unknown; confirmPassword?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const code = typeof body.code === 'string' ? body.code.trim() : '';
	const password = typeof body.password === 'string' ? body.password : '';
	const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

	if (!email || !code || !password) throw error(400, 'Faltan datos');

	if (password.length < 8 || password.length > 128) {
		throw error(400, 'La contraseña debe tener entre 8 y 128 caracteres');
	}

	if (password !== confirmPassword) throw error(400, 'Las contraseñas no coinciden');

	const result = await verifyResetCode(email, code, password);
	if (!result.ok) {
		const status =
			result.reason === 'not_found' ? 404 : result.reason === 'too_many_attempts' ? 429 : 400;
		throw error(status, reasonMessage[result.reason]);
	}

	return json({ ok: true, redirectTo: '/auth/login?reset=1' });
};
