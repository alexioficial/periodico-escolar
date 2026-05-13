import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';
import { serialize } from '$lib/server/serialize';

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
	const page = parseInt(url.searchParams.get('page') || '1');

	const escapedFilter = emailFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const query = emailFilter ? { email: { $regex: escapedFilter, $options: 'i' } } : {};

	const totalUsers = await db.collection('users').countDocuments(query);
	const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

	const users = await db
		.collection('users')
		.find(query)
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
	return { success: true };
}

export const actions: Actions = {
	promoteToAdmin: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(401, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'admin');
	},
	promoteToSuperadmin: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(401, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'superadmin');
	},
	demoteToAdmin: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(401, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'admin');
	},
	demoteToUser: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') return fail(401, { message: 'No autorizado' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { message: 'ID requerido' });
		return setRole(id, locals.user._id, 'user');
	}
};
