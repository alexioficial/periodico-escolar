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
	// Mensaje uniforme para not_found/invalid_code para no permitir enumerar
	// si un correo tiene un código activo (= si la cuenta existe).
	not_found: 'Código inválido o expirado. Solicita uno nuevo.',
	expired: 'El código expiró. Solicita uno nuevo.',
	too_many_attempts: 'Demasiados intentos. Solicita un nuevo código.',
	invalid_code: 'Código inválido o expirado. Solicita uno nuevo.'
} as const;

export const actions: Actions = {
	verify: async ({ request, getClientAddress, locals }) => {
		const rl = await checkRateLimit({
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
		const formEmail = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const code = String(form.get('code') ?? '').trim();

		// Si hay sesión, ignoramos el email del form y forzamos el del usuario
		// logueado: evita que un atacante con sesión verifique el correo de
		// otra cuenta enviando un email distinto.
		const email = locals.user ? locals.user.email.toLowerCase() : formEmail;

		if (!email || !code) return fail(400, { message: 'Faltan datos', email });

		const result = await verifyEmailCode(email, code);
		if (!result.ok) {
			const status =
				result.reason === 'not_found' ? 404 : result.reason === 'too_many_attempts' ? 429 : 400;
			return fail(status, { message: reasonMessage[result.reason], email });
		}

		if (locals.user) {
			throw redirect(303, '/perfil?verified=1');
		}
		throw redirect(303, '/auth/login?verified=1');
	},
	resend: async ({ request, getClientAddress, locals }) => {
		const rl = await checkRateLimit({
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
		const formEmail = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const email = locals.user ? locals.user.email.toLowerCase() : formEmail;

		if (!email) return fail(400, { message: 'Correo requerido', email });

		try {
			await createAndSendVerificationCode(email);
		} catch {
			// Silencioso para no revelar si el correo existe.
		}
		return { success: true, message: 'Si el correo es válido, te enviamos un código.', email };
	}
};
