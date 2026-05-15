import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyEmailCode } from '$lib/server/verification';
import { checkRateLimit } from '$lib/server/rateLimit';

const reasonMessage = {
	not_found: 'Código inválido o expirado. Solicita uno nuevo.',
	expired: 'El código expiró. Solicita uno nuevo.',
	too_many_attempts: 'Demasiados intentos. Solicita un nuevo código.',
	invalid_code: 'Código inválido o expirado. Solicita uno nuevo.'
} as const;

export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	const rl = await checkRateLimit({
		key: `verify:${getClientAddress()}`,
		limit: 10,
		windowMs: 5 * 60_000
	});
	if (!rl.ok) {
		throw error(429, `Demasiados intentos. Vuelve a intentarlo en ${rl.retryAfter}s.`);
	}

	let body: { email?: unknown; code?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const formEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const code = typeof body.code === 'string' ? body.code.trim() : '';

	// Si hay sesión, ignoramos el email del body y forzamos el del usuario logueado.
	const email = locals.user ? locals.user.email.toLowerCase() : formEmail;

	if (!email || !code) throw error(400, 'Faltan datos');

	const result = await verifyEmailCode(email, code);
	if (!result.ok) {
		const status =
			result.reason === 'not_found' ? 404 : result.reason === 'too_many_attempts' ? 429 : 400;
		throw error(status, reasonMessage[result.reason]);
	}

	return json({
		ok: true,
		redirectTo: locals.user ? '/perfil?verified=1' : '/auth/login?verified=1'
	});
};
