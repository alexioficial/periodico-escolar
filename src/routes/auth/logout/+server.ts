import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/session';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ cookies, request, url, getClientAddress }) => {
	// Defensa contra CSRF: solo aceptamos POST con Origin del mismo sitio.
	// SvelteKit no aplica el origin check a `+server.ts` endpoints automáticamente.
	const origin = request.headers.get('origin');
	if (origin && new URL(origin).origin !== url.origin) {
		throw error(403, 'Origin no permitido');
	}

	const rl = await checkRateLimit({
		key: `logout:${getClientAddress()}`,
		limit: 30,
		windowMs: 60_000
	});
	if (!rl.ok) {
		throw error(429, 'Demasiadas solicitudes');
	}

	const token = cookies.get('session');

	if (token) {
		await deleteSession(token);
		cookies.delete('session', { path: '/' });
	}

	throw redirect(303, '/auth/login');
};
