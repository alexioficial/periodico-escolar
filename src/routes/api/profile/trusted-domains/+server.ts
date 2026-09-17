import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/rateLimit';
import { handleTrustedDomainMutation } from '$lib/server/trustedDomainRequest';
import {
	mutateTrustedDomainInCollection,
	type TrustedDomainUserDoc
} from '$lib/server/trustedDomains';

const dependencies = {
	checkRateLimit,
	async mutate(userId: string, domain: string, operation: 'add' | 'remove') {
		const db = await getDb();
		return mutateTrustedDomainInCollection(
			db.collection<TrustedDomainUserDoc>('users'),
			userId,
			domain,
			operation
		);
	}
};

export const POST: RequestHandler = ({ request, locals }) =>
	handleTrustedDomainMutation(request, locals.user, 'add', dependencies);
export const DELETE: RequestHandler = ({ request, locals }) =>
	handleTrustedDomainMutation(request, locals.user, 'remove', dependencies);
