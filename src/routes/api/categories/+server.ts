import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCategory } from '$lib/server/categories';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (locals.user?.role !== 'superadmin') throw error(403, 'No autorizado');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}
	const name = (body as { name?: unknown })?.name;
	if (typeof name !== 'string' || name.trim() === '') {
		throw error(400, 'El nombre es requerido');
	}

	try {
		const id = await createCategory(name.trim());
		return json({ ok: true, id: id.toString() }, { status: 201 });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Error desconocido');
	}
};
