import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createUser } from '$lib/server/auth';
import { createAndSendVerificationCode } from '$lib/server/verification';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!email || !username || !password) {
			return json({ message: 'Faltan datos' }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ message: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
		}

		await createUser(email, username, password);
		await createAndSendVerificationCode(email);
		return json({
			message: 'Cuenta creada. Revisa tu correo para ingresar el código de verificación.'
		});
	} catch (error: unknown) {
		console.error('Error en registro:', error);

		if (error instanceof Error && error.message.includes('ya está registrado')) {
			return json({ message: error.message }, { status: 400 });
		}

		return json({ message: 'Error interno al registrarse' }, { status: 500 });
	}
};
