import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleLike } from '$lib/server/articles';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'No autorizado');

	const limit = await checkRateLimit({
		key: `article-like:${locals.user._id}`,
		limit: 60,
		windowMs: 60_000
	});
	if (!limit.ok) throw error(429, `Vuelve a intentarlo en ${limit.retryAfter}s.`);

	const isLiked = await toggleLike(params.id, locals.user._id);
	if (isLiked === null) throw error(404, 'Artículo no encontrado');
	return json({ ok: true, isLiked });
};
