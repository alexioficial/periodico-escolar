import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';
import { deleteAllSessionsForUser } from '$lib/server/session';

const VALID_ROLES = new Set(['user', 'admin', 'superadmin']);

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (locals.user?.role !== 'superadmin') throw error(403, 'No autorizado');

	const targetId = params.id;
	if (typeof targetId !== 'string' || !ObjectId.isValid(targetId)) {
		throw error(400, 'ID de usuario inválido');
	}
	if (targetId === locals.user._id) {
		throw error(400, 'No puedes modificar tu propio rol');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}
	const role = (body as { role?: unknown })?.role;
	if (typeof role !== 'string' || !VALID_ROLES.has(role)) {
		throw error(400, 'Rol inválido');
	}

	const db = await getDb();
	const users = db.collection('users');
	const target = await users.findOne({ _id: new ObjectId(targetId) });
	if (!target) throw error(404, 'Usuario no encontrado');

	if (target.role === 'superadmin' && role !== 'superadmin') {
		const remainingSuperadmins = await users.countDocuments({
			role: 'superadmin',
			_id: { $ne: target._id }
		});
		if (remainingSuperadmins === 0) {
			throw error(400, 'No puedes quitar al último superadmin');
		}
	}

	await users.updateOne({ _id: target._id }, { $set: { role } });
	if (target.role !== role) {
		await deleteAllSessionsForUser(target._id);
	}

	return json({ ok: true });
};
