import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getUserBySessionToken } from '$lib/server/session';
import { getViewUrl } from '$lib/server/storage';
import { checkRateLimit } from '$lib/server/rateLimit';
import { getPublicRateLimitPolicy } from '$lib/server/publicRateLimit';

async function resolvePictureUrl(picture: string | undefined | null): Promise<string | undefined> {
	if (!picture) return undefined;
	if (/^https?:\/\//i.test(picture)) return picture;
	try {
		return await getViewUrl(picture);
	} catch (error) {
		console.error('Error al firmar URL de avatar:', error);
		return undefined;
	}
}

const sessionHandle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('session');

	if (sessionToken) {
		try {
			const user = await getUserBySessionToken(sessionToken);

			event.locals.user = user
				? {
						_id: user._id.toString(),
						email: user.email,
						provider: user.provider,
						role: user.role || 'user',
						username: user.username,
						name: user.name,
						picture: await resolvePictureUrl(user.picture)
					}
				: null;
		} catch (error) {
			console.error('Error al recuperar usuario de la sesión:', error);
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};

// Política de seguridad de contenido. Permitimos:
// - JS/CSS del mismo origen
// - Imágenes y videos del mismo origen, data: (favicons inline) y https: (S3 firmado + Google avatars)
// - 'unsafe-inline' en script-src es necesario para los scripts que Svelte
//   inyecta para hidratación; idealmente cambiar a nonces (requiere config).
// - static.cloudflareinsights.com: beacon de Cloudflare Web Analytics
//   (lo inyecta Cloudflare en el edge). El POST de telemetría a
//   cloudflareinsights.com ya entra por connect-src https:.
const CSP_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"media-src 'self' blob: https:",
	"font-src 'self' data:",
	"connect-src 'self' https:",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'"
].join('; ');

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=()'
	);
	response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);

	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};

const publicRateLimitHandle: Handle = async ({ event, resolve }) => {
	if (event.request.method !== 'GET' || event.locals.user) return resolve(event);

	const policy = getPublicRateLimitPolicy(event.url.pathname);
	if (!policy) return resolve(event);

	const result = await checkRateLimit({
		key: `${policy.scope}:${event.getClientAddress()}`,
		limit: policy.limit,
		windowMs: policy.windowMs,
		onError: 'closed'
	});

	if (!result.ok) {
		const headers = new Headers({
			'Retry-After': String(result.retryAfter),
			'X-RateLimit-Limit': String(policy.limit),
			'X-RateLimit-Remaining': '0'
		});
		if (event.url.pathname.startsWith('/api/')) {
			headers.set('Content-Type', 'application/json; charset=utf-8');
			return new Response(JSON.stringify({ message: 'Demasiadas solicitudes' }), {
				status: 429,
				headers
			});
		}
		return new Response('Demasiadas solicitudes. Intenta de nuevo más tarde.', {
			status: 429,
			headers
		});
	}

	const response = await resolve(event);
	response.headers.set('X-RateLimit-Limit', String(policy.limit));
	response.headers.set('X-RateLimit-Remaining', String(result.remaining));
	return response;
};

// El rate limit necesita la sesión resuelta. Security envuelve la respuesta
// para que incluso los 429 tempranos reciban CSP y el resto de headers.
export const handle: Handle = sequence(sessionHandle, securityHeadersHandle, publicRateLimitHandle);
