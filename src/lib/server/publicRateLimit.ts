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

	if (
		pathname === '/login' ||
		pathname === '/auth/google' ||
		pathname === '/auth/google/callback' ||
		pathname.startsWith('/auth/m/')
	) {
		return { scope: 'public-auth-pages', limit: 30, windowMs: 5 * 60_000 };
	}

	return null;
}

export function shouldApplyPublicRateLimit(
	method: string,
	pathname: string,
	isAuthenticated: boolean
): boolean {
	if (method !== 'GET' || !getPublicRateLimitPolicy(pathname)) return false;
	return (
		!isAuthenticated ||
		pathname.startsWith('/post/') ||
		pathname === '/login' ||
		pathname.startsWith('/auth/')
	);
}
