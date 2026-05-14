import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createAndSendResetCode } from '$lib/server/passwordReset';
import { checkRateLimit } from '$lib/server/rateLimit';

export const load: PageServerLoad = async ({ url }) => {
	return {
		email: url.searchParams.get('email') ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const rl = await checkRateLimit({
			key: `forgot:${getClientAddress()}`,
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
			await createAndSendResetCode(email);
		} catch (error) {
			console.error('Error al generar reset code:', error);
		}

		throw redirect(303, `/auth/reset-password?email=${encodeURIComponent(email)}`);
	}
};
