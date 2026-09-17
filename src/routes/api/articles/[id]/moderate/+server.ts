import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateArticleStatus } from '$lib/server/articles';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || !['admin', 'superadmin'].includes(locals.user.role)) {
		throw error(401, 'No autorizado');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Cuerpo JSON inválido');
	}
	const decision = (body as { decision?: unknown })?.decision;
	if (decision !== 'approve' && decision !== 'reject') {
		throw error(400, 'Decisión inválida');
	}
	const revision = (body as { revision?: unknown })?.revision;
	if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0)
		throw error(400, 'Versión de revisión inválida');

	let reason: string | undefined;
	if (decision === 'reject') {
		const raw = (body as { reason?: unknown })?.reason;
		if (raw !== undefined && typeof raw !== 'string') {
			throw error(400, 'Motivo inválido');
		}
		reason = typeof raw === 'string' ? raw.trim().slice(0, 500) || undefined : undefined;
	}

	try {
		const ok = await updateArticleStatus(
			params.id,
			decision === 'approve' ? 'published' : 'rejected',
			reason,
			revision
		);
		if (!ok)
			throw error(
				409,
				'El artículo cambió o ya no está pendiente. Recarga y revisa la versión actual.'
			);
		return json({ ok: true });
	} catch (e) {
		if (isHttpError(e)) throw e;
		console.error(e);
		throw error(
			500,
			decision === 'approve' ? 'Error al aprobar el artículo' : 'Error al rechazar el artículo'
		);
	}
};
