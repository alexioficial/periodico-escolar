import type { Handle } from '@sveltejs/kit';
import { getUserBySessionToken } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('session');

	if (sessionToken) {
		try {
			const user = await getUserBySessionToken(sessionToken);

			event.locals.user = user
				? {
						_id: user._id,
						email: user.email,
						provider: user.provider
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
