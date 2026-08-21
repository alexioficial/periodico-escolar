import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPublishedArticles,
	countPublishedArticles,
	enrichArticlesWithUrls
} from '$lib/server/articles';
import { toPublicArticle } from '$lib/server/publicArticle';
import { getCategories } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';

const ARTICLES_PER_PAGE = 10;

export const GET: RequestHandler = async ({ url, locals }) => {
	const categoryId = url.searchParams.get('categoryId') || undefined;
	// `parseInt('abc')` da NaN, y `Math.max(1, NaN)` → NaN, propagando un skip
	// NaN a Mongo. Clampeamos correctamente.
	const pageRaw = parseInt(url.searchParams.get('page') || '1');
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const skip = (page - 1) * ARTICLES_PER_PAGE;

	const [articles, totalCount, categories] = await Promise.all([
		getPublishedArticles(categoryId, skip, ARTICLES_PER_PAGE),
		countPublishedArticles(categoryId),
		getCategories()
	]);

	const userId = locals.user?._id;
	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c]));

	const articlesWithUrls = await enrichArticlesWithUrls(articles);

	const enrichedArticles = articlesWithUrls.map((article) => {
		const publicArticle = toPublicArticle(article);
		const likes = article.likes ?? [];
		const savedBy = article.savedBy ?? [];
		return {
			...publicArticle,
			authorDisplay: publicArticle.authorUsername?.trim() || 'Autor',
			categoryName: categoryMap.get(publicArticle.categoryId)?.name || 'Sin categoría',
			isLiked: userId ? likes.includes(userId) : false,
			isSaved: userId ? savedBy.includes(userId) : false,
			likesCount: likes.length
		};
	});

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
