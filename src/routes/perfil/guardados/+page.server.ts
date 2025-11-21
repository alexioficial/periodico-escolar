import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSavedArticles } from '$lib/server/articles';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	const savedArticles = await getSavedArticles(locals.user._id);

	const enrichedArticles = savedArticles.map((article) => ({
		...article,
		_id: article._id.toString(),
		isLiked: article.likes?.includes(locals.user!._id) || false,
		isSaved: true,
		likesCount: article.likes?.length || 0
	}));

	return {
		articles: JSON.parse(JSON.stringify(enrichedArticles)),
		user: locals.user
	};
};
