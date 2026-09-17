import type { LayoutServerLoad } from './$types';
import { sanitizeTrustedDomains } from '$lib/trustedDomains';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user
			? { ...locals.user, trustedDomains: sanitizeTrustedDomains(locals.user.trustedDomains) }
			: null
	};
};
