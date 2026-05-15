import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getUserBySessionToken } from '$lib/server/session';
import { getViewUrl } from '$lib/server/storage';

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

export const handle: Handle = sequence(sessionHandle, securityHeadersHandle);
