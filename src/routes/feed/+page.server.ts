import type { PageServerLoad } from './$types';
import {
	getPublishedArticles,
	countPublishedArticles,
	enrichArticlesWithUrls
} from '$lib/server/articles';
import { toPublicArticle } from '$lib/server/publicArticle';
import { getCategories } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';

const ARTICLES_PER_PAGE = 10;

export const load: PageServerLoad = async ({ url, locals }) => {
	const categoryId = url.searchParams.get('categoryId') || undefined;
	// Clamp: sin esto `?page=-100` o `?page=abc` propagan skip negativo/NaN y
	// Mongo lanza un error que se convierte en 500 visible al usuario.
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

	// Privacidad: el feed es público. Exponer `authorEmail` permite scraping de
	// correos. Devolvemos `authorDisplay` derivado del username/name, o un
	// fallback genérico cuando ni siquiera había snapshot.
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

	return {
		articles: serialize(enrichedArticles),
		categories: serialize(categories),
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
