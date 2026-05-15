import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ObjectId } from 'mongodb';
import { getUserById } from '$lib/server/auth';
import { createAndSendVerificationCode } from '$lib/server/verification';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'No autorizado');

	const rl = await checkRateLimit({
		key: `verify-from-profile:${locals.user._id}`,
		limit: 3,
		windowMs: 60 * 60_000
	});
	if (!rl.ok) {
		throw error(429, `Demasiadas solicitudes. Vuelve a intentarlo en ${rl.retryAfter}s.`);
	}

	const userId = new ObjectId(locals.user._id);
	const current = await getUserById(userId);
	if (!current) throw error(404, 'Usuario no encontrado');

	if (current.provider !== 'credentials') {
		throw error(400, 'Tu correo lo gestiona el proveedor externo.');
	}
	if (current.emailVerified === true) {
		throw error(400, 'Tu correo ya está verificado.');
	}

	try {
		await createAndSendVerificationCode(current.email);
	} catch (e) {
		console.error('Error al enviar código de verificación:', e);
		throw error(500, 'No se pudo enviar el código. Intenta de nuevo.');
	}

	return json({
		ok: true,
		redirectTo: `/auth/verify-email?email=${encodeURIComponent(current.email)}`
	});
};
