import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setLike } from '$lib/server/articles';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'No autorizado');
	let body: { liked?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}
	if (typeof body.liked !== 'boolean') throw error(400, 'Estado de like inválido');

	const limit = await checkRateLimit({
		key: `article-like:${locals.user._id}`,
		limit: 60,
		windowMs: 60_000
	});
	if (!limit.ok) throw error(429, `Vuelve a intentarlo en ${limit.retryAfter}s.`);

	const result = await setLike(params.id, locals.user._id, body.liked);
	if (!result) throw error(404, 'Artículo no encontrado');
	return json({ ok: true, ...result });
};
