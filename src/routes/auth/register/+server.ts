import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createUser } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim().toLowerCase();
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return json({ message: 'Faltan datos' }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ message: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
		}

		await createUser(email, password);
		return json({ message: 'Usuario creado correctamente' });
	} catch (error: unknown) {
		console.error('Error en registro:', error);

		if (error instanceof Error && error.message.includes('ya está registrado')) {
			return json({ message: error.message }, { status: 400 });
		}

		return json({ message: 'Error interno al registrarse' }, { status: 500 });
	}
};
