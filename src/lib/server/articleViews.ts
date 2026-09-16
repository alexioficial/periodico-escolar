import { ObjectId } from 'mongodb';

type ViewCollection = {
	updateOne(
		filter: { _id: ObjectId; status: 'published' },
		update: { $inc: { views: number } }
	): Promise<{ matchedCount: number }>;
};

export async function incrementPublishedArticleView(
	collection: ViewCollection,
	id: string
): Promise<boolean> {
	if (!/^[a-f\d]{24}$/i.test(id)) return false;
	const result = await collection.updateOne(
		{ _id: new ObjectId(id), status: 'published' },
		{ $inc: { views: 1 } }
	);
	return result.matchedCount === 1;
}
