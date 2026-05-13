import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPublishedArticles,
	countPublishedArticles,
	enrichArticlesWithUrls
} from '$lib/server/articles';
import { getCategories } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';

const ARTICLES_PER_PAGE = 10;

export const GET: RequestHandler = async ({ url, locals }) => {
	const categoryId = url.searchParams.get('categoryId') || undefined;
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const skip = (page - 1) * ARTICLES_PER_PAGE;

	const [articles, totalCount, categories] = await Promise.all([
		getPublishedArticles(categoryId, skip, ARTICLES_PER_PAGE),
		countPublishedArticles(categoryId),
		getCategories()
	]);

	const userId = locals.user?._id;
	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c]));

	const articlesWithUrls = await enrichArticlesWithUrls(articles);

	const enrichedArticles = articlesWithUrls.map((article) => ({
		...article,
		_id: article._id!.toString(),
		categoryName: categoryMap.get(article.categoryId)?.name || 'Sin categoría',
		isLiked: userId ? (article.likes?.includes(userId) ?? false) : false,
		isSaved: userId ? (article.savedBy?.includes(userId) ?? false) : false,
		likesCount: article.likes?.length || 0
	}));

	const totalPages = Math.ceil(totalCount / ARTICLES_PER_PAGE);

	return json({
		articles: serialize(enrichedArticles),
		pagination: {
			currentPage: page,
			totalPages,
			totalCount,
			hasMore: page < totalPages
		}
	});
};
