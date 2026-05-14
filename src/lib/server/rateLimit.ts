import type { ObjectId } from 'mongodb';
import { MongoServerError } from 'mongodb';
import { getDb } from './db';

const COLLECTION = 'rate_limit_buckets';

interface BucketDoc {
	_id: ObjectId;
	key: string;
	count: number;
	resetAt: Date;
}

export interface RateLimitOptions {
	key: string;
	limit: number;
	windowMs: number;
	/**
	 * Comportamiento si Mongo falla. Por defecto `'open'` (`ok: true`) para no
	 * tumbar el sitio entero, pero los endpoints sensibles (login, reset,
	 * verificación) deberían pasar `'closed'` para no dejar deshabilitar el
	 * rate limit forzando una caída de DB.
	 */
	onError?: 'open' | 'closed';
}

export interface RateLimitResult {
	ok: boolean;
	remaining: number;
	retryAfter: number;
}

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
		const now = new Date();

		// Si hay un bucket vivo, incrementamos atómicamente y leemos el resultado.
		const updated = await buckets.findOneAndUpdate(
			{ key, resetAt: { $gt: now } },
			{ $inc: { count: 1 } },
			{ returnDocument: 'after' }
		);

		if (updated) {
			if (updated.count > limit) {
				return {
					ok: false,
					remaining: 0,
					retryAfter: Math.ceil((updated.resetAt.getTime() - now.getTime()) / 1000)
				};
			}
			return { ok: true, remaining: limit - updated.count, retryAfter: 0 };
		}

		// No había bucket vivo: lo creamos (o pisamos uno expirado) con upsert.
		const resetAt = new Date(now.getTime() + windowMs);
		try {
			await buckets.updateOne({ key }, { $set: { count: 1, resetAt } }, { upsert: true });
			return { ok: true, remaining: limit - 1, retryAfter: 0 };
		} catch (error) {
			// Otro request creó el bucket entre nuestro find y nuestro upsert.
			// Reintentamos una vez para incrementar contra el bucket recién creado.
			if (error instanceof MongoServerError && error.code === 11000) {
				return checkRateLimit({ key, limit, windowMs });
			}
			throw error;
		}
	} catch (error) {
		console.error('Rate limit fallback (Mongo no disponible):', error);
		if (onError === 'closed') {
			return { ok: false, remaining: 0, retryAfter: Math.ceil(windowMs / 1000) };
		}
		return { ok: true, remaining: limit - 1, retryAfter: 0 };
	}
}
