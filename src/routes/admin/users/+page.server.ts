import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';
import { serialize } from '$lib/server/serialize';
import { deleteAllSessionsForUser } from '$lib/server/session';

const USERS_PER_PAGE = 10;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	if (locals.user.role !== 'superadmin') {
		throw redirect(303, '/redaccion');
	}

	const db = await getDb();
	const emailFilter = url.searchParams.get('email') || '';
	const pageRaw = parseInt(url.searchParams.get('page') || '1');
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const escapedFilter = emailFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const query = emailFilter ? { email: { $regex: escapedFilter, $options: 'i' } } : {};

	const totalUsers = await db.collection('users').countDocuments(query);
	const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

	// Whitelist explícita de campos a devolver al cliente. Sin la proyección,
	// `serialize(users)` enviaría passwordHash, googleId, etc. al navegador.
	const users = await db
		.collection('users')
		.find(query, {
			projection: {
				_id: 1,
				email: 1,
				username: 1,
				name: 1,
				role: 1,
				provider: 1,
				emailVerified: 1,
				createdAt: 1
			}
		})
		.skip((page - 1) * USERS_PER_PAGE)
		.limit(USERS_PER_PAGE)
		.toArray();

	return {
		user: locals.user,
		users: serialize(users),
		pagination: {
			currentPage: page,
			totalPages,
			totalUsers,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1
		},
		emailFilter
	};
};

type Role = 'user' | 'admin' | 'superadmin';

async function setRole(targetId: string, currentUserId: string, newRole: Role) {
	if (typeof targetId !== 'string' || !ObjectId.isValid(targetId)) {
		return fail(400, { message: 'ID de usuario inválido' });
	}
	if (targetId === currentUserId) {
		return fail(400, { message: 'No puedes modificar tu propio rol' });
	}

	const db = await getDb();
	const users = db.collection('users');
	const target = await users.findOne({ _id: new ObjectId(targetId) });
	if (!target) return fail(404, { message: 'Usuario no encontrado' });

	if (target.role === 'superadmin' && newRole !== 'superadmin') {
		const remainingSuperadmins = await users.countDocuments({
			role: 'superadmin',
			_id: { $ne: target._id }
		});
		if (remainingSuperadmins === 0) {
			return fail(400, { message: 'No puedes quitar al último superadmin' });
		}
	}

	await users.updateOne({ _id: target._id }, { $set: { role: newRole } });
	// Forzamos re-login del usuario afectado: si lo degradan, no debe seguir
	// con cookies que le permitían operar como admin/superadmin.
	if (target.role !== newRole) {
		await deleteAllSessionsForUser(target._id);
	}
	return { success: true };
}

export const actions: Actions = {
	promoteToAdmin: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(403, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'admin');
	},
	promoteToSuperadmin: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(403, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'superadmin');
	},
	demoteToAdmin: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(403, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'admin');
	},
	demoteToUser: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(403, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'user');
	}
};
