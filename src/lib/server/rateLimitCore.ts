import { MongoServerError, type Collection, type ObjectId } from 'mongodb';

export interface BucketDoc {
	_id: ObjectId;
	key: string;
	count: number;
	resetAt: Date;
}

export interface CoreRateLimitOptions {
	key: string;
	limit: number;
	windowMs: number;
}

export interface RateLimitResult {
	ok: boolean;
	remaining: number;
	retryAfter: number;
}

type BucketCollection = Pick<Collection<BucketDoc>, 'findOneAndUpdate' | 'updateOne'>;

export async function checkRateLimitInCollection(
	buckets: BucketCollection,
	options: CoreRateLimitOptions,
	now = new Date()
): Promise<RateLimitResult> {
	const { key, limit, windowMs } = options;
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

	const resetAt = new Date(now.getTime() + windowMs);
	try {
		// Un bucket recién creado por otro request no debe reiniciarse aquí.
		// Su key única provoca E11000 y el reintento suma con $inc.
		await buckets.updateOne(
			{ key, resetAt: { $lte: now } },
			{ $set: { count: 1, resetAt } },
			{ upsert: true }
		);
		return { ok: true, remaining: limit - 1, retryAfter: 0 };
	} catch (error) {
		if (error instanceof MongoServerError && error.code === 11000) {
			return checkRateLimitInCollection(buckets, options, now);
		}
		throw error;
	}
}
