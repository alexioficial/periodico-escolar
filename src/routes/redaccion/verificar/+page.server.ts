import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPendingArticles, enrichArticlesWithUrls } from '$lib/server/articles';
import { getCategories } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';
import { loginPath } from '$lib/server/redirect';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, loginPath(`${url.pathname}${url.search}`));
	}

	if (!['admin', 'superadmin'].includes(locals.user.role)) {
		throw redirect(303, '/redaccion');
	}

	const [pendingArticles, categories] = await Promise.all([getPendingArticles(), getCategories()]);
	const articlesWithUrls = await enrichArticlesWithUrls(pendingArticles);

	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c.name]));

	const enrichedArticles = articlesWithUrls.map((article) => ({
		...article,
		_id: article._id!.toString(),
		category: categoryMap.get(article.categoryId) ?? 'Sin categoría'
	}));

	return {
		user: locals.user,
		articles: serialize(enrichedArticles)
	};
};
