import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getUserBySessionToken } from '$lib/server/session';

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
						role: user.role || 'user'
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

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=()'
	);

	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};

export const handle: Handle = sequence(sessionHandle, securityHeadersHandle);
