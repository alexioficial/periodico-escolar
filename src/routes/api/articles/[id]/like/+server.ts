import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setLike } from '$lib/server/articles';
import { checkRateLimit } from '$lib/server/rateLimit';
import { LimitedJsonBodyError, readLimitedJsonBody } from '$lib/server/requestBody';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'No autorizado');

	const limit = await checkRateLimit({
		key: `article-like:${locals.user._id}`,
		limit: 60,
		windowMs: 60_000
	});
	if (!limit.ok) throw error(429, `Vuelve a intentarlo en ${limit.retryAfter}s.`);

	let body: { liked?: unknown };
	try {
		body = (await readLimitedJsonBody(request, 256)) as typeof body;
	} catch (cause) {
		if (cause instanceof LimitedJsonBodyError) throw error(cause.status, cause.message);
		throw cause;
	}
	if (typeof body.liked !== 'boolean') throw error(400, 'Estado de like inválido');

	const result = await setLike(params.id, locals.user._id, body.liked);
	if (!result) throw error(404, 'Artículo no encontrado');
	return json({ ok: true, ...result });
};
