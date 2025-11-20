import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    countArticlesByCategory,
    ensureDefaultCategories
} from '$lib/server/categories';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(303, '/auth/login');
    }

    if (locals.user.role !== 'superadmin') {
        throw redirect(303, '/redaccion');
    }

    // Ensure default categories exist
    await ensureDefaultCategories();

    const categories = await getCategories();

    // Add article count to each category
    const categoriesWithCount = await Promise.all(
        categories.map(async (cat) => ({
            ...cat,
            _id: cat._id!.toString(),
            articlesCount: await countArticlesByCategory(cat._id!.toString())
        }))
    );

    return {
        user: locals.user,
        categories: JSON.parse(JSON.stringify(categoriesWithCount))
    };
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        if (locals.user?.role !== 'superadmin') {
            return fail(401, { message: 'No autorizado' });
        }

        const formData = await request.formData();
        const name = formData.get('name') as string;

        if (!name || name.trim() === '') {
            return fail(400, { message: 'El nombre es requerido' });
        }

        try {
            await createCategory(name.trim());
            return { success: true };
        } catch (error: any) {
            return fail(400, { message: error.message });
        }
    },

    update: async ({ request, locals }) => {
        if (locals.user?.role !== 'superadmin') {
            return fail(401, { message: 'No autorizado' });
        }

        const formData = await request.formData();
        const id = formData.get('id') as string;
        const name = formData.get('name') as string;

        if (!id || !name || name.trim() === '') {
            return fail(400, { message: 'Datos inválidos' });
        }

        try {
            await updateCategory(id, name.trim());
            return { success: true };
        } catch (error: any) {
            return fail(400, { message: error.message });
        }
    },

    delete: async ({ request, locals }) => {
        if (locals.user?.role !== 'superadmin') {
            return fail(401, { message: 'No autorizado' });
        }

        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) {
            return fail(400, { message: 'ID requerido' });
        }

        try {
            await deleteCategory(id);
            return { success: true };
        } catch (error: any) {
            return fail(400, { message: error.message });
        }
    }
};
