import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserById } from '$lib/server/auth';
import { createDirectLoginSession } from '$lib/server/directLogin';
import { createSession, deleteSession } from '$lib/server/session';

export const load: PageServerLoad = async ({ params, cookies, setHeaders }) => {
	setHeaders({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
	const token = await createDirectLoginSession(params.id, getUserById, createSession);
	if (!token) throw error(404, 'No encontrado');

	const oldToken = cookies.get('session');
	if (oldToken) await deleteSession(oldToken);
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 7 * 24 * 60 * 60
	});
	throw redirect(303, '/feed');
};
