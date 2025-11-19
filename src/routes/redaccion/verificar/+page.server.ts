import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getPendingArticles, updateArticleStatus } from '$lib/server/articles';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(303, '/auth/login');
    }

    if (!['admin', 'superadmin'].includes(locals.user.role)) {
        throw redirect(303, '/redaccion');
    }

    const pendingArticles = await getPendingArticles();

    return {
        user: locals.user,
        articles: JSON.parse(JSON.stringify(pendingArticles))
    };
};

export const actions: Actions = {
    approve: async ({ request, locals }) => {
        if (!locals.user || !['admin', 'superadmin'].includes(locals.user.role)) {
            return fail(401, { message: 'No autorizado' });
        }

        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) {
            return fail(400, { message: 'ID requerido' });
        }

        try {
            await updateArticleStatus(id, 'published');
            return { success: true };
        } catch (error) {
            console.error(error);
            return fail(500, { message: 'Error al aprobar el artículo' });
        }
    },
    reject: async ({ request, locals }) => {
        if (!locals.user || !['admin', 'superadmin'].includes(locals.user.role)) {
            return fail(401, { message: 'No autorizado' });
        }

        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) {
            return fail(400, { message: 'ID requerido' });
        }

        try {
            await updateArticleStatus(id, 'rejected');
            return { success: true };
        } catch (error) {
            console.error(error);
            return fail(500, { message: 'Error al rechazar el artículo' });
        }
    }
};
