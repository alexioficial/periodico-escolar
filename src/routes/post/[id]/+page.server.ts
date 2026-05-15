import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getArticleById, enrichArticleWithUrls } from '$lib/server/articles';
import { getCategoryById } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';

export const load: PageServerLoad = async ({ params, locals }) => {
	const doc = await getArticleById(params.id);
	if (!doc || doc.status !== 'published') {
		throw error(404, 'Artículo no encontrado');
	}

	const enriched = await enrichArticleWithUrls(doc);
	const category = enriched.categoryId ? await getCategoryById(enriched.categoryId) : null;

	const userId = locals.user?._id;
	const { authorEmail: _email, ...rest } = enriched;

	const article = {
		...rest,
		_id: rest._id!.toString(),
		authorDisplay: rest.authorUsername?.trim() || 'Autor',
		categoryName: category?.name || 'Sin categoría',
		isLiked: userId ? (rest.likes?.includes(userId) ?? false) : false,
		isSaved: userId ? (rest.savedBy?.includes(userId) ?? false) : false,
		likesCount: rest.likes?.length || 0
	};

	return {
		article: serialize(article),
		user: locals.user
	};
};
