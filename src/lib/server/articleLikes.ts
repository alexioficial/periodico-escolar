import { ObjectId } from 'mongodb';

type LikeCollection = {
	findOne(filter: { _id: ObjectId; status: 'published' }): Promise<{ likes?: string[] } | null>;
	updateOne(
		filter: { _id: ObjectId; status: 'published' },
		update: { $addToSet: { likes: string } } | { $pull: { likes: string } }
	): Promise<{ matchedCount: number }>;
};

export function getArticleLikeSummary(likes: string[] | undefined, userId: string | undefined) {
	const privateLikes = likes ?? [];
	return {
		isLiked: userId ? privateLikes.includes(userId) : false,
		likesCount: privateLikes.length
	};
}

/**
 * Alterna el like únicamente si el artículo está publicado.
 * Retorna el nuevo estado, o null cuando el artículo/entrada no es válido.
 */
export async function togglePublishedArticleLike(
	collection: LikeCollection,
	articleId: string,
	userId: string
): Promise<boolean | null> {
	if (typeof articleId !== 'string' || !ObjectId.isValid(articleId)) return null;
	if (typeof userId !== 'string' || !userId) return null;

	const filter = { _id: new ObjectId(articleId), status: 'published' as const };
	const article = await collection.findOne(filter);
	if (!article) return null;

	const wasLiked = (article.likes ?? []).includes(userId);
	const result = await collection.updateOne(
		filter,
		wasLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } }
	);
	return result.matchedCount === 1 ? !wasLiked : null;
}
