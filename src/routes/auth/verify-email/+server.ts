import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { verifyEmailCode } from '$lib/server/verification';

export const POST: RequestHandler = async ({ request }) => {
	const form = await request.formData();
	const email = String(form.get('email') ?? '')
		.trim()
		.toLowerCase();
	const code = String(form.get('code') ?? '').trim();

	if (!email || !code) return json({ message: 'Faltan datos' }, { status: 400 });

	const result = await verifyEmailCode(email, code);
	if (!result.ok) {
		switch (result.reason) {
			case 'not_found':
				return json({ message: 'No hay un código activo para este correo' }, { status: 404 });
			case 'expired':
				return json({ message: 'El código expiró. Solicita uno nuevo.' }, { status: 400 });
			case 'too_many_attempts':
				return json({ message: 'Demasiados intentos. Solicita un nuevo código.' }, { status: 429 });
			case 'invalid_code':
				return json({ message: 'Código inválido' }, { status: 400 });
			default:
				return json({ message: 'No se pudo verificar' }, { status: 400 });
		}
	}

	return json({ message: 'Correo verificado' });
};
