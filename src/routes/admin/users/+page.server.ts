import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
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
