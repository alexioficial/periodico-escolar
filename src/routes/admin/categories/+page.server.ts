import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getCategories,
	countArticlesByCategory,
	ensureDefaultCategories
} from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	if (locals.user.role !== 'superadmin') {
		throw redirect(303, '/redaccion');
	}

	await ensureDefaultCategories();

	const categories = await getCategories();

	const categoriesWithCount = await Promise.all(
		categories.map(async (cat) => ({
			...cat,
			_id: cat._id!.toString(),
			articlesCount: await countArticlesByCategory(cat._id!.toString())
		}))
	);

	return {
		user: locals.user,
		categories: serialize(categoriesWithCount)
	};
};
