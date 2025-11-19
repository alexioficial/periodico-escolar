import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(303, '/auth/login');
    }

    if (locals.user.role !== 'superadmin') {
        throw redirect(303, '/redaccion');
    }

    const db = await getDb();
    const users = await db.collection('users').find({}).toArray();

    return {
        user: locals.user,
        users: JSON.parse(JSON.stringify(users))
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
