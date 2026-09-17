import { ObjectId, type Collection, type Filter } from 'mongodb';
import type { ArticleDoc } from './articles';

/** A decision is valid only for the exact pending snapshot the reviewer saw. */
export async function reviewArticleRevision(
	collection: Pick<Collection<ArticleDoc>, 'updateOne'>,
	id: string,
	status: 'published' | 'rejected',
	revision: number,
	reason?: string,
	now = new Date()
): Promise<boolean> {
	if (
		!/^[a-f\d]{24}$/i.test(id) ||
		!Number.isSafeInteger(revision) ||
		revision < 0 ||
		!['published', 'rejected'].includes(status)
	)
		return false;
	const filter: Filter<ArticleDoc> = {
		_id: new ObjectId(id),
		status: 'pending',
		...(revision === 0
			? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
			: { revision })
	};
	const update: { status: 'published' | 'rejected'; publishedAt?: Date; rejectionReason?: string } =
		{ status };
	if (status === 'published') update.publishedAt = now;
	if (status === 'rejected' && typeof reason === 'string' && reason.trim())
		update.rejectionReason = reason.trim().slice(0, 500);
	const result = await collection.updateOne(filter, { $set: update });
	return result.matchedCount === 1;
}
