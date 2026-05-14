import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getPendingArticles, updateArticleStatus } from '$lib/server/articles';
import { getCategories } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	if (!['admin', 'superadmin'].includes(locals.user.role)) {
		throw redirect(303, '/redaccion');
	}

	const [pendingArticles, categories] = await Promise.all([getPendingArticles(), getCategories()]);

	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c.name]));

	const enrichedArticles = pendingArticles.map((article) => ({
		...article,
		category: categoryMap.get(article.categoryId) ?? 'Sin categoría'
	}));

	return {
		user: locals.user,
		articles: serialize(enrichedArticles)
	};
};

export const actions: Actions = {
	approve: async ({ request, locals }) => {
		if (!locals.user || !['admin', 'superadmin'].includes(locals.user.role)) {
			return fail(401, { message: 'No autorizado' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'ID requerido' });
		}

		try {
			const ok = await updateArticleStatus(id, 'published');
			if (!ok) {
				return fail(409, { message: 'El artículo ya no está pendiente de revisión' });
			}
			return { success: true };
		} catch (error) {
			console.error(error);
			return fail(500, { message: 'Error al aprobar el artículo' });
		}
	},
	reject: async ({ request, locals }) => {
		if (!locals.user || !['admin', 'superadmin'].includes(locals.user.role)) {
			return fail(401, { message: 'No autorizado' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'ID requerido' });
		}

		try {
			const ok = await updateArticleStatus(id, 'rejected');
			if (!ok) {
				return fail(409, { message: 'El artículo ya no está pendiente de revisión' });
			}
			return { success: true };
		} catch (error) {
			console.error(error);
			return fail(500, { message: 'Error al rechazar el artículo' });
		}
	}
};
