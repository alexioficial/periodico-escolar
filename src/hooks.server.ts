import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getUserBySessionToken } from '$lib/server/session';
import { handle as authHandle } from './auth';

const sessionHandle: Handle = async ({ event, resolve }) => {
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
        // If there is no custom session, try Auth.js session
        if (typeof (event.locals as any).auth === 'function') {
            try {
                const session = await (event.locals as any).auth();
                if (session?.user?.email) {
                    event.locals.user = {
                        _id: undefined as unknown as string,
                        email: session.user.email,
                        provider: 'google'
                    } as any;
                } else {
                    event.locals.user = null;
                }
            } catch {
                event.locals.user = null;
            }
        } else {
            event.locals.user = null;
        }
    }

    return resolve(event);
};

export const handle: Handle = sequence(authHandle, sessionHandle);
