import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { validateUser } from '$lib/server/auth';
import { createSession } from '$lib/server/session';
import { checkRateLimit } from '$lib/server/rateLimit';

// Sólo aceptamos returnTo a paths internos (no URLs absolutas). Esto bloquea
// el clásico "open redirect" via ?returnTo=https://atacante.com.
function safeReturnTo(raw: string | null): string {
	if (typeof raw !== 'string' || !raw) return '/redaccion';
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/redaccion';
	return raw;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));

	if (locals.user) {
		throw redirect(303, returnTo);
	}

	const error = url.searchParams.get('error');
	return {
		csrfError: error === 'csrf',
		accountConflict: error === 'account_conflict',
		passwordReset: url.searchParams.get('reset') === '1',
		returnTo
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const rl = await checkRateLimit({
			key: `login:${getClientAddress()}`,
			limit: 5,
			windowMs: 5 * 60_000,
			onError: 'closed'
		});
		if (!rl.ok) {
			return fail(429, {
				message: `Demasiados intentos. Vuelve a intentarlo en ${rl.retryAfter}s.`,
				email: ''
			});
		}

		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '');
		const returnTo = safeReturnTo(
			(formData.get('returnTo') as string) ?? url.searchParams.get('returnTo')
		);

		if (!email || !password) {
			return fail(400, { message: 'Faltan datos', email });
		}

		let user;
		try {
			user = await validateUser(email, password);
		} catch (error) {
			console.error('Error en login:', error);
			return fail(500, { message: 'Error interno al iniciar sesión', email });
		}

		if (!user) {
			return fail(401, { message: 'Correo o contraseña incorrectos', email });
		}

		if (user.provider === 'credentials' && user.emailVerified === false) {
			return fail(403, {
				message:
					'Tu correo no está verificado. Revisa tu bandeja o solicita un nuevo código en /auth/verify-email.',
				email
			});
		}

		const token = await createSession(user._id);
		const secure = process.env.NODE_ENV === 'production';

		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			maxAge: 60 * 60 * 24 * 7
		});

		throw redirect(303, returnTo);
	}
};
