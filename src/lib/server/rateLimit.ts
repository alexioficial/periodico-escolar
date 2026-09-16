import { getDb } from './db';
import {
	checkRateLimitInCollection,
	type BucketDoc,
	type CoreRateLimitOptions,
	type RateLimitResult
} from './rateLimitCore';

const COLLECTION = 'rate_limit_buckets';

export interface RateLimitOptions extends CoreRateLimitOptions {
	/**
	 * Comportamiento si Mongo falla. Por defecto `'open'` (`ok: true`) para no
	 * tumbar el sitio entero, pero los endpoints sensibles (login, reset,
	 * verificación) deberían pasar `'closed'` para no dejar deshabilitar el
	 * rate limit forzando una caída de DB.
	 */
	onError?: 'open' | 'closed';
}

export type { RateLimitResult };

/**
 * Rate limit persistido en Mongo: sobrevive reinicios y se comparte entre
 * instancias horizontales.
 *
 * El índice TTL en `resetAt` (creado en `db.ts`) limpia automáticamente
 * los buckets expirados.
 */
export async function checkRateLimit({
	key,
	limit,
	windowMs,
	onError = 'open'
}: RateLimitOptions): Promise<RateLimitResult> {
	try {
		const db = await getDb();
		const buckets = db.collection<BucketDoc>(COLLECTION);
		return checkRateLimitInCollection(buckets, { key, limit, windowMs });
	} catch (error) {
		console.error('Rate limit fallback (Mongo no disponible):', error);
		if (onError === 'closed') {
			return { ok: false, remaining: 0, retryAfter: Math.ceil(windowMs / 1000) };
		}
		return { ok: true, remaining: limit - 1, retryAfter: 0 };
	}
}
