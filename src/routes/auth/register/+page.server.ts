import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createUser,
	EmailAlreadyRegisteredError,
	UsernameTakenError,
	USERNAME_REGEX
} from '$lib/server/auth';
import { createAndSendVerificationCode } from '$lib/server/verification';
import { checkRateLimit } from '$lib/server/rateLimit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/redaccion');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const rl = await checkRateLimit({
			key: `register:${getClientAddress()}`,
			limit: 3,
			windowMs: 5 * 60_000
		});
		if (!rl.ok) {
			return fail(429, {
				message: `Demasiados intentos. Vuelve a intentarlo en ${rl.retryAfter}s.`,
				email: '',
				username: ''
			});
		}

		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const confirmPassword = String(formData.get('confirmPassword') ?? '');

		if (!email || !username || !password) {
			return fail(400, { message: 'Faltan datos', email, username });
		}

		if (!USERNAME_REGEX.test(username)) {
			return fail(400, {
				message:
					'El nombre de usuario debe tener 3-20 caracteres y solo letras, números, ".", "_" o "-".',
				email,
				username
			});
		}

		if (password.length < 6) {
			return fail(400, {
				message: 'La contraseña debe tener al menos 6 caracteres',
				email,
				username
			});
		}

		if (password !== confirmPassword) {
			return fail(400, { message: 'Las contraseñas no coinciden', email, username });
		}

		try {
			await createUser(email, username, password);
		} catch (error) {
			if (error instanceof UsernameTakenError) {
				return fail(400, { message: error.message, email, username });
			}
			if (!(error instanceof EmailAlreadyRegisteredError)) {
				console.error('Error en registro:', error);
				return fail(500, { message: 'Error interno al registrarse', email, username });
			}
			// EmailAlreadyRegistered: silenciamos para no enumerar correos.
			// El usuario legítimo recibirá igualmente el código de verificación
			// abajo si todavía no había completado el flujo.
		}

		try {
			await createAndSendVerificationCode(email);
		} catch {
			// Silencioso — no revelamos si el correo existe.
		}

		throw redirect(303, `/auth/verify-email?email=${encodeURIComponent(email)}`);
	}
};
