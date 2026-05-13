interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
	key: string;
	limit: number;
	windowMs: number;
}

export interface RateLimitResult {
	ok: boolean;
	remaining: number;
	retryAfter: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
	const now = Date.now();
	const bucket = buckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { ok: true, remaining: limit - 1, retryAfter: 0 };
	}

	if (bucket.count >= limit) {
		return {
			ok: false,
			remaining: 0,
			retryAfter: Math.ceil((bucket.resetAt - now) / 1000)
		};
	}

	bucket.count++;
	return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

declare global {
	var __rateLimitCleanup: ReturnType<typeof setInterval> | undefined;
}

if (!globalThis.__rateLimitCleanup) {
	globalThis.__rateLimitCleanup = setInterval(() => {
		const now = Date.now();
		for (const [key, bucket] of buckets) {
			if (bucket.resetAt <= now) buckets.delete(key);
		}
	}, 60_000);
}
