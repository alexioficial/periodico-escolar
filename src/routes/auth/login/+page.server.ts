import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function safeReturnTo(raw: string | null): string {
	if (typeof raw !== 'string' || !raw) return '/redaccion';
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/redaccion';
	return raw;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));

	if (locals.user) {
		throw redirect(303, returnTo);
	}

	const error = url.searchParams.get('error');
	return {
		csrfError: error === 'csrf',
		accountConflict: error === 'account_conflict',
		passwordReset: url.searchParams.get('reset') === '1',
		returnTo
	};
};
