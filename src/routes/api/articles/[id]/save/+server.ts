import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleSave } from '$lib/server/articles';
import { checkRateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'No autorizado');

	const rl = await checkRateLimit({
		key: `feed-toggle:${locals.user._id}`,
		limit: 60,
		windowMs: 60_000
	});
	if (!rl.ok) throw error(429, `Vuelve a intentarlo en ${rl.retryAfter}s.`);

	await toggleSave(params.id, locals.user._id);
	return json({ ok: true });
};
