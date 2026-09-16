import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserByEmail } from '$lib/server/auth';
import { assertMagicLinkRequestAllowed, normalizeEmail } from '$lib/server/authEmailPolicy';
import { createMagicLink } from '$lib/server/magicLink';
import { checkRateLimit } from '$lib/server/rateLimit';
import { safeReturnTo } from '$lib/server/redirect';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	const ipLimit = await checkRateLimit({
		key: `magic-link-ip:${getClientAddress()}`,
		limit: 5,
		windowMs: 15 * 60_000,
		onError: 'closed'
	});
	if (!ipLimit.ok) throw error(429, `Demasiadas solicitudes. Vuelve en ${ipLimit.retryAfter}s.`);

	let body: { email?: unknown; returnTo?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}

	const email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
	if (!email || !EMAIL_REGEX.test(email) || email.length > 254) throw error(400, 'Correo inválido');

	const emailLimit = await checkRateLimit({
		key: `magic-link-email:${email}`,
		limit: 3,
		windowMs: 60 * 60_000,
		onError: 'closed'
	});
	if (!emailLimit.ok) return json({ ok: true });

	const existing = await getUserByEmail(email);
	try {
		assertMagicLinkRequestAllowed(email, !!existing);
	} catch (cause) {
		throw error(403, cause instanceof Error ? cause.message : 'Correo no permitido');
	}

	try {
		await createMagicLink(email, url.origin, safeReturnTo(body.returnTo, '/feed'));
	} catch (cause) {
		console.error('Error al crear magic link:', cause);
		throw error(502, 'No se pudo enviar el enlace de acceso');
	}

	return json({ ok: true });
};
