export interface PublicRateLimitPolicy {
	scope: string;
	limit: number;
	windowMs: number;
}

/** Rutas de lectura que pueden usarse sin sesión y golpean Mongo/S3. */
export function getPublicRateLimitPolicy(pathname: string): PublicRateLimitPolicy | null {
	if (pathname === '/api/feed') {
		return { scope: 'public-feed-api', limit: 60, windowMs: 5 * 60_000 };
	}

	if (pathname === '/feed' || pathname.startsWith('/post/')) {
		return { scope: 'public-pages', limit: 120, windowMs: 5 * 60_000 };
	}

	if (/^\/login\/[a-f\d]{24}$/i.test(pathname)) {
		return { scope: 'direct-login', limit: 20, windowMs: 5 * 60_000 };
	}

	return null;
}
