import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyEmailCode, createAndSendVerificationCode } from '$lib/server/verification';
import { checkRateLimit } from '$lib/server/rateLimit';

export const load: PageServerLoad = async ({ url }) => {
	return {
		email: url.searchParams.get('email') ?? ''
	};
};

const reasonMessage = {
	not_found: 'No hay un código activo para este correo',
	expired: 'El código expiró. Solicita uno nuevo.',
	too_many_attempts: 'Demasiados intentos. Solicita un nuevo código.',
	invalid_code: 'Código inválido'
} as const;

export const actions: Actions = {
	verify: async ({ request, getClientAddress }) => {
		const rl = checkRateLimit({
			key: `verify:${getClientAddress()}`,
			limit: 10,
			windowMs: 5 * 60_000
		});
		if (!rl.ok) {
			return fail(429, {
				message: `Demasiados intentos. Vuelve a intentarlo en ${rl.retryAfter}s.`
			});
		}

		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const code = String(form.get('code') ?? '').trim();

		if (!email || !code) return fail(400, { message: 'Faltan datos', email });

		const result = await verifyEmailCode(email, code);
		if (!result.ok) {
			const status =
				result.reason === 'not_found' ? 404 : result.reason === 'too_many_attempts' ? 429 : 400;
			return fail(status, { message: reasonMessage[result.reason], email });
		}

		throw redirect(303, '/auth/login?verified=1');
	},
	resend: async ({ request, getClientAddress }) => {
		const rl = checkRateLimit({
			key: `resend:${getClientAddress()}`,
			limit: 3,
			windowMs: 60 * 60_000
		});
		if (!rl.ok) {
			return fail(429, {
				message: `Demasiadas solicitudes. Vuelve a intentarlo en ${rl.retryAfter}s.`
			});
		}

		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		if (!email) return fail(400, { message: 'Correo requerido', email });

		try {
			await createAndSendVerificationCode(email);
			return { success: true, message: 'Código reenviado. Revisa tu correo.', email };
		} catch {
			return fail(400, { message: 'No se pudo reenviar el código', email });
		}
	}
};
