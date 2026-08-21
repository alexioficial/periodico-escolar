import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { MongoServerError, ObjectId, type Db } from 'mongodb';
import { deleteAllSessionsForUser } from '$lib/server/session';
import crypto from 'crypto';

const VALID_ROLES = new Set(['user', 'admin', 'superadmin']);

async function acquireRoleChangeLock(db: Db): Promise<() => Promise<void>> {
	const locks = db.collection<{ _id: string; owner: string; expiresAt: Date }>('operation_locks');
	const owner = crypto.randomUUID();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 15_000);

	try {
		const lock = await locks.findOneAndUpdate(
			{
				_id: 'user-role-change',
				$or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }]
			},
			{ $set: { owner, expiresAt } },
			{ upsert: true, returnDocument: 'after' }
		);
		if (!lock || lock.owner !== owner) throw error(409, 'Hay otro cambio de rol en curso');
	} catch (cause) {
		if (cause instanceof MongoServerError && cause.code === 11000) {
			throw error(409, 'Hay otro cambio de rol en curso. Intenta de nuevo.');
		}
		throw cause;
	}

	return async () => {
		await locks.deleteOne({ _id: 'user-role-change', owner });
	};
}

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
	const releaseLock = await acquireRoleChangeLock(db);
	let target;
	try {
		target = await users.findOne({ _id: new ObjectId(targetId) });
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
	} finally {
		await releaseLock();
	}

	return json({ ok: true });
};
