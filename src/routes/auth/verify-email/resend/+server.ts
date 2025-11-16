import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createAndSendVerificationCode } from '$lib/server/verification';

export const POST: RequestHandler = async ({ request }) => {
	const { email } = (await request.json().catch(() => ({}))) as { email?: string };
	const normalized = (email ?? '').trim().toLowerCase();
	if (!normalized) return json({ message: 'Correo requerido' }, { status: 400 });

	try {
		await createAndSendVerificationCode(normalized);
		return json({ message: 'Código reenviado' });
	} catch (e) {
		return json({ message: 'No se pudo reenviar el código' }, { status: 400 });
	}
};
