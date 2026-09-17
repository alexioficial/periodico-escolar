import { getTrustedDomainFromUrl, normalizeTrustedDomain } from '../trustedDomains';
import { LimitedJsonBodyError, readLimitedJsonBody } from './requestBody';
import type { TrustedDomainMutationResult } from './trustedDomains';
import type { CoreRateLimitOptions, RateLimitResult } from './rateLimitCore';

interface MutationDependencies {
	checkRateLimit(options: CoreRateLimitOptions & { onError: 'closed' }): Promise<RateLimitResult>;
	mutate(
		userId: string,
		domain: string,
		operation: 'add' | 'remove'
	): Promise<TrustedDomainMutationResult>;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
	});
}

/** Testable HTTP boundary; the user ID comes exclusively from the resolved session. */
export async function handleTrustedDomainMutation(
	request: Request,
	user: { _id: string } | null,
	operation: 'add' | 'remove',
	dependencies: MutationDependencies
): Promise<Response> {
	if (!user) return json({ message: 'No autorizado' }, 401);
	const limit = await dependencies.checkRateLimit({
		key: `trusted-domains:${user._id}`,
		limit: 30,
		windowMs: 600_000,
		onError: 'closed'
	});
	if (!limit.ok)
		return json({ message: 'Demasiadas solicitudes' }, 429, {
			'Retry-After': String(limit.retryAfter)
		});
	let body: unknown;
	try {
		body = await readLimitedJsonBody(request, 4096);
	} catch (cause) {
		if (cause instanceof LimitedJsonBodyError)
			return json({ message: cause.message }, cause.status);
		throw cause;
	}
	if (!body || typeof body !== 'object' || Array.isArray(body))
		return json({ message: 'Datos inválidos' }, 400);
	const fields = body as Record<string, unknown>;
	const domain =
		operation === 'add'
			? getTrustedDomainFromUrl(fields.url)
			: normalizeTrustedDomain(fields.domain);
	if (!domain) return json({ message: 'Dominio inválido' }, 400);
	const result = await dependencies.mutate(user._id, domain, operation);
	if (result.status === 'not-found') return json({ message: 'Usuario no encontrado' }, 404);
	if (result.status === 'full')
		return json({ message: 'Puedes guardar como máximo 100 dominios' }, 409);
	if (result.status === 'invalid') return json({ message: 'Dominio inválido' }, 400);
	return json({ ok: true, trustedDomains: result.trustedDomains });
}
