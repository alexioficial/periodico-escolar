import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSavedArticles, enrichArticlesWithUrls } from '$lib/server/articles';
import { getCategories } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	const [savedArticles, categories] = await Promise.all([
		getSavedArticles(locals.user._id),
		getCategories()
	]);

	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c.name]));

	const articlesWithUrls = await enrichArticlesWithUrls(savedArticles);

	const enrichedArticles = articlesWithUrls.map(({ authorEmail: _email, ...article }) => ({
		...article,
		_id: article._id!.toString(),
		authorDisplay: article.authorUsername?.trim() || 'Autor',
		category: categoryMap.get(article.categoryId) ?? 'Sin categoría',
		isLiked: article.likes?.includes(locals.user!._id) || false,
		isSaved: true,
		likesCount: article.likes?.length || 0
	}));

	return {
		articles: serialize(enrichedArticles),
		user: locals.user
	};
};
