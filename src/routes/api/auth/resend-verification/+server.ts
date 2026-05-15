import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAndSendVerificationCode } from '$lib/server/verification';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	const rl = await checkRateLimit({
		key: `resend:${getClientAddress()}`,
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

	const formEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const email = locals.user ? locals.user.email.toLowerCase() : formEmail;

	if (!email) throw error(400, 'Correo requerido');

	try {
		await createAndSendVerificationCode(email);
	} catch {
		// Silencioso para no revelar si el correo existe.
	}
	return json({ ok: true, message: 'Si el correo es válido, te enviamos un código.' });
};
