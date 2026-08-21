import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSavedArticles, countSavedArticles, enrichArticlesWithUrls } from '$lib/server/articles';
import { toPublicArticle } from '$lib/server/publicArticle';
import { getCategories } from '$lib/server/categories';
import { serialize } from '$lib/server/serialize';
import { loginPath } from '$lib/server/redirect';

const PER_PAGE = 20;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, loginPath(`${url.pathname}${url.search}`));
	}

	const pageRaw = parseInt(url.searchParams.get('page') || '1');
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const [savedArticles, totalCount, categories] = await Promise.all([
		getSavedArticles(locals.user._id, (page - 1) * PER_PAGE, PER_PAGE),
		countSavedArticles(locals.user._id),
		getCategories()
	]);

	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c.name]));

	const articlesWithUrls = await enrichArticlesWithUrls(savedArticles);

	const enrichedArticles = articlesWithUrls.map((article) => {
		const publicArticle = toPublicArticle(article);
		const likes = article.likes ?? [];
		return {
			...publicArticle,
			authorDisplay: publicArticle.authorUsername?.trim() || 'Autor',
			category: categoryMap.get(publicArticle.categoryId) ?? 'Sin categoría',
			isLiked: likes.includes(locals.user!._id),
			isSaved: true,
			likesCount: likes.length
		};
	});

	const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

	return {
		articles: serialize(enrichedArticles),
		user: locals.user,
		pagination: {
			currentPage: page,
			totalPages,
			totalCount,
			hasMore: page < totalPages
		}
	};
};
