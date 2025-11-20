import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';

const USERS_PER_PAGE = 10;

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        throw redirect(303, '/auth/login');
    }

    if (locals.user.role !== 'superadmin') {
        throw redirect(303, '/redaccion');
    }

    const db = await getDb();
    const emailFilter = url.searchParams.get('email') || '';
    const page = parseInt(url.searchParams.get('page') || '1');

    // Build query
    const query = emailFilter
        ? { email: { $regex: emailFilter, $options: 'i' } }
        : {};

    // Get total count
    const totalUsers = await db.collection('users').countDocuments(query);
    const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

    // Get paginated users
    const users = await db.collection('users')
        .find(query)
        .skip((page - 1) * USERS_PER_PAGE)
        .limit(USERS_PER_PAGE)
        .toArray();

    return {
        user: locals.user,
        users: JSON.parse(JSON.stringify(users)),
        pagination: {
            currentPage: page,
            totalPages,
            totalUsers,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        emailFilter
    };
};

export const actions: Actions = {
    promote: async ({ request, locals }) => {
        if (locals.user?.role !== 'superadmin') {
            return fail(401, { message: 'No autorizado' });
        }

        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) return fail(400, { message: 'ID requerido' });

        const db = await getDb();
        await db.collection('users').updateOne(
            { _id: new ObjectId(id) },
            { $set: { role: 'admin' } }
        );

        return { success: true };
    },
    demote: async ({ request, locals }) => {
        if (locals.user?.role !== 'superadmin') {
            return fail(401, { message: 'No autorizado' });
        }

        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) return fail(400, { message: 'ID requerido' });

        const db = await getDb();
        await db.collection('users').updateOne(
            { _id: new ObjectId(id) },
            { $set: { role: 'user' } }
        );

        return { success: true };
    }
};
