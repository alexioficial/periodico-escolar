import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAndSendResetCode } from '$lib/server/passwordReset';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rl = await checkRateLimit({
		key: `forgot:${getClientAddress()}`,
		limit: 3,
		windowMs: 60 * 60_000
	});
	if (!rl.ok) {
		throw error(429, `Demasiadas solicitudes. Vuelve a intentarlo en ${rl.retryAfter}s.`);
	}

	let body: { email?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	if (!email) throw error(400, 'Correo requerido');

	try {
		await createAndSendResetCode(email);
	} catch (e) {
		console.error('Error al generar reset code:', e);
	}

	return json({
		ok: true,
		redirectTo: `/auth/reset-password?email=${encodeURIComponent(email)}`
	});
};
