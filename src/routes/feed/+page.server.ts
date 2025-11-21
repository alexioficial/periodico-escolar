import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getPublishedArticles,
	countPublishedArticles,
	toggleLike,
	toggleSave
} from '$lib/server/articles';
import { getCategories } from '$lib/server/categories';

const ARTICLES_PER_PAGE = 10;

export const load: PageServerLoad = async ({ url, locals }) => {
	const categoryId = url.searchParams.get('categoryId') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const skip = (page - 1) * ARTICLES_PER_PAGE;

	const [articles, totalCount, categories] = await Promise.all([
		getPublishedArticles(categoryId, skip, ARTICLES_PER_PAGE),
		countPublishedArticles(categoryId),
		getCategories()
	]);

	const userId = locals.user?._id;

	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c]));

	const enrichedArticles = articles.map((article) => ({
		...article,
		_id: article._id.toString(),
		categoryName: categoryMap.get(article.categoryId)?.name || 'Sin categoría',
		isLiked: userId ? article.likes?.includes(userId) : false,
		isSaved: userId ? article.savedBy?.includes(userId) : false,
		likesCount: article.likes?.length || 0
	}));

	const totalPages = Math.ceil(totalCount / ARTICLES_PER_PAGE);

	return {
		articles: JSON.parse(JSON.stringify(enrichedArticles)),
		categories: JSON.parse(JSON.stringify(categories)),
		currentCategoryId: categoryId,
		user: locals.user,
		pagination: {
			currentPage: page,
			totalPages,
			totalCount,
			hasMore: page < totalPages
		}
	};
};

export const actions: Actions = {
	toggleLike: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();
		const id = data.get('id') as string;
		await toggleLike(id, locals.user._id);
		return { success: true };
	},
	toggleSave: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();
		const id = data.get('id') as string;
		await toggleSave(id, locals.user._id);
		return { success: true };
	}
};
