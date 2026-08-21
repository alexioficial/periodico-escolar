import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createMagicLink } from '$lib/server/magicLink';
import { checkRateLimit } from '$lib/server/rateLimit';
import { safeReturnTo } from '$lib/server/redirect';

// Validación básica de formato. La autoridad de existencia la tiene el correo
// real (si no llega, no llega).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	const ip = getClientAddress();

	const rlIp = await checkRateLimit({
		key: `magic-link-ip:${ip}`,
		limit: 5,
		windowMs: 15 * 60_000,
		onError: 'closed'
	});
	if (!rlIp.ok) {
		throw error(429, `Demasiadas solicitudes. Volvé en ${rlIp.retryAfter}s.`);
	}

	let body: { email?: unknown; returnTo?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const returnTo = safeReturnTo(body.returnTo, '/feed');

	if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
		throw error(400, 'Correo inválido');
	}

	const rlEmail = await checkRateLimit({
		key: `magic-link-email:${email}`,
		limit: 3,
		windowMs: 60 * 60_000,
		onError: 'closed'
	});
	if (!rlEmail.ok) {
		// Silencioso: devolvemos ok aún si el correo se rate-limiteó, para no
		// dar señales sobre quién pidió cuántos links. El bucket protege igual.
		return json({ ok: true });
	}

	try {
		await createMagicLink(email, url.origin, returnTo);
	} catch (e) {
		console.error('Error al crear magic link:', e);
		// No revelamos detalles — siempre ok desde fuera.
	}

	return json({ ok: true });
};
