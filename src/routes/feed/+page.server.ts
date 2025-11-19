import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getPublishedArticles, toggleLike, toggleSave } from '$lib/server/articles';

export const load: PageServerLoad = async ({ url, locals }) => {
    const category = url.searchParams.get('category') || undefined;
    const articles = await getPublishedArticles(category);
    const userId = locals.user?._id;

    // Add isLiked and isSaved flags for the current user
    const enrichedArticles = articles.map(article => ({
        ...article,
        _id: article._id.toString(),
        isLiked: userId ? article.likes?.includes(userId) : false,
        isSaved: userId ? article.savedBy?.includes(userId) : false,
        likesCount: article.likes?.length || 0
    }));

    return {
        articles: JSON.parse(JSON.stringify(enrichedArticles)),
        currentCategory: category,
        user: locals.user
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
