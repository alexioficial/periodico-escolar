import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordPublishedArticleView } from '$lib/server/articles';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ params, request, url, getClientAddress }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) throw error(403, 'Origin no permitido');

	const limit = await checkRateLimit({
		key: `article-view:${getClientAddress()}`,
		limit: 300,
		windowMs: 5 * 60_000,
		onError: 'closed'
	});
	if (!limit.ok) throw error(429, 'Demasiadas solicitudes');
	if (!(await recordPublishedArticleView(params.id))) throw error(404, 'Artículo no encontrado');
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
