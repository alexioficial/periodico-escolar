import { ObjectId } from 'mongodb';
import { normalizeTrustedDomain, sanitizeTrustedDomains } from '../trustedDomains';

export interface TrustedDomainUserDoc {
	_id: ObjectId;
	trustedDomains?: string[];
}

export type TrustedDomainMutationResult =
	| { status: 'ok'; trustedDomains: string[] }
	| { status: 'full' }
	| { status: 'not-found' }
	| { status: 'invalid' };

type TrustedDomainFilter = {
	_id: ObjectId;
	$or?: ({ trustedDomains: string } | { 'trustedDomains.99': { $exists: boolean } })[];
};

type TrustedDomainCollection = {
	findOneAndUpdate(
		filter: TrustedDomainFilter,
		update: { $addToSet: { trustedDomains: string } } | { $pull: { trustedDomains: string } },
		options: { returnDocument: 'after'; projection: { trustedDomains: 1 } }
	): Promise<{ trustedDomains?: string[] } | null>;
	findOne(filter: { _id: ObjectId }, options: { projection: { _id: 1 } }): Promise<object | null>;
};

/** The cap lives in the atomic update filter, not in a race-prone preceding read. */
export async function mutateTrustedDomainInCollection(
	collection: TrustedDomainCollection,
	userId: string,
	value: string,
	operation: 'add' | 'remove'
): Promise<TrustedDomainMutationResult> {
	if (typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId)) return { status: 'not-found' };
	const domain = normalizeTrustedDomain(value);
	if (!domain || (operation !== 'add' && operation !== 'remove')) return { status: 'invalid' };
	const _id = new ObjectId(userId);
	const filter =
		operation === 'add'
			? { _id, $or: [{ trustedDomains: domain }, { 'trustedDomains.99': { $exists: false } }] }
			: { _id };
	const user = await collection.findOneAndUpdate(
		filter,
		operation === 'add'
			? { $addToSet: { trustedDomains: domain } }
			: { $pull: { trustedDomains: domain } },
		{ returnDocument: 'after', projection: { trustedDomains: 1 } }
	);
	if (user) return { status: 'ok', trustedDomains: sanitizeTrustedDomains(user.trustedDomains) };
	if (operation === 'remove') return { status: 'not-found' };
	// Only distinguish a capped account from a deleted account after the guarded write failed.
	const existing = await collection.findOne({ _id }, { projection: { _id: 1 } });
	return { status: existing ? 'full' : 'not-found' };
}
