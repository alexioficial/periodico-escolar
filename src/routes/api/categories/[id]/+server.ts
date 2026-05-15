import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateCategory, deleteCategory } from '$lib/server/categories';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
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
		await updateCategory(params.id, name.trim());
		return json({ ok: true });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Error desconocido');
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (locals.user?.role !== 'superadmin') throw error(403, 'No autorizado');

	try {
		await deleteCategory(params.id);
		return json({ ok: true });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Error desconocido');
	}
};
