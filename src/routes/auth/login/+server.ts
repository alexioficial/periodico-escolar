import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { validateUser } from '$lib/server/auth';
import { createSession } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return json({ message: 'Faltan datos' }, { status: 400 });
		}

		const user = await validateUser(email, password);
		if (!user) {
			return json({ message: 'Correo o contraseña incorrectos' }, { status: 401 });
		}

		if (user.provider === 'credentials' && user.emailVerified === false) {
			return json(
				{
					message:
						'Tu correo no está verificado. Revisa tu bandeja o solicita un nuevo código en /auth/verify-email.'
				},
				{ status: 403 }
			);
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

		return json({ message: 'Login correcto', redirectTo: '/redaccion' });
	} catch (error) {
		console.error('Error en login:', error);
		return json({ message: 'Error interno al iniciar sesión' }, { status: 500 });
	}
};
