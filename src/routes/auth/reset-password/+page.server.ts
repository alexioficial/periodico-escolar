import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyResetCode } from '$lib/server/passwordReset';
import { checkRateLimit } from '$lib/server/rateLimit';

export const load: PageServerLoad = async ({ url }) => {
	return {
		email: url.searchParams.get('email') ?? ''
	};
};

const reasonMessage = {
	// Uniformamos not_found/invalid_code/expired para no enumerar correos.
	not_found: 'Código inválido o expirado. Solicita uno nuevo.',
	expired: 'Código inválido o expirado. Solicita uno nuevo.',
	too_many_attempts: 'Demasiados intentos. Solicita un nuevo código.',
	invalid_code: 'Código inválido o expirado. Solicita uno nuevo.',
	invalid_password: 'La contraseña debe tener entre 8 y 128 caracteres.'
} as const;

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const rl = await checkRateLimit({
			key: `reset:${getClientAddress()}`,
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
		const password = String(form.get('password') ?? '');
		const confirmPassword = String(form.get('confirmPassword') ?? '');

		if (!email || !code || !password) {
			return fail(400, { message: 'Faltan datos', email });
		}

		if (password.length < 8 || password.length > 128) {
			return fail(400, {
				message: 'La contraseña debe tener entre 8 y 128 caracteres',
				email
			});
		}

		if (password !== confirmPassword) {
			return fail(400, { message: 'Las contraseñas no coinciden', email });
		}

		const result = await verifyResetCode(email, code, password);
		if (!result.ok) {
			const status =
				result.reason === 'not_found' ? 404 : result.reason === 'too_many_attempts' ? 429 : 400;
			return fail(status, { message: reasonMessage[result.reason], email });
		}

		throw redirect(303, '/auth/login?reset=1');
	}
};
