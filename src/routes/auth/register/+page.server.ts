import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createUser, EmailAlreadyRegisteredError, UsernameTakenError } from '$lib/server/auth';
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
		const rl = checkRateLimit({
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
			await createAndSendVerificationCode(email);
		} catch (error) {
			if (error instanceof EmailAlreadyRegisteredError || error instanceof UsernameTakenError) {
				return fail(400, { message: error.message, email, username });
			}
			console.error('Error en registro:', error);
			return fail(500, { message: 'Error interno al registrarse', email, username });
		}

		throw redirect(303, `/auth/verify-email?email=${encodeURIComponent(email)}`);
	}
};
