import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getArticleById, enrichArticleWithUrls } from '$lib/server/articles';
import { toPublicArticle } from '$lib/server/publicArticle';
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
	const publicArticle = toPublicArticle(enriched);
	const likes = enriched.likes ?? [];
	const savedBy = enriched.savedBy ?? [];

	const article = {
		...publicArticle,
		authorDisplay: publicArticle.authorUsername?.trim() || 'Autor',
		categoryName: category?.name || 'Sin categoría',
		isLiked: userId ? likes.includes(userId) : false,
		isSaved: userId ? savedBy.includes(userId) : false,
		likesCount: likes.length
	};

	return {
		article: serialize(article),
		user: locals.user
	};
};
