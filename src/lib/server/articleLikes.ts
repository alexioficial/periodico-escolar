import { ObjectId } from 'mongodb';

type LikeCollection = {
	findOneAndUpdate(
		filter: { _id: ObjectId; status: 'published' },
		update: { $addToSet: { likes: string } } | { $pull: { likes: string } },
		options: { returnDocument: 'after'; projection: { likes: 1 } }
	): Promise<{ likes?: string[] } | null>;
};

export function getArticleLikeSummary(likes: string[] | undefined, userId: string | undefined) {
	const privateLikes = likes ?? [];
	return {
		isLiked: userId ? privateLikes.includes(userId) : false,
		likesCount: privateLikes.length
	};
}

/**
 * Fija el estado deseado en una única operación atómica sobre un artículo publicado.
 * Retorna el estado persistido, o null cuando el artículo/entrada no es válido.
 */
export async function setPublishedArticleLike(
	collection: LikeCollection,
	articleId: string,
	userId: string,
	liked: boolean
): Promise<{ isLiked: boolean; likesCount: number } | null> {
	if (typeof articleId !== 'string' || !ObjectId.isValid(articleId)) return null;
	if (typeof userId !== 'string' || !userId) return null;
	if (typeof liked !== 'boolean') return null;

	const filter = { _id: new ObjectId(articleId), status: 'published' as const };
	const article = await collection.findOneAndUpdate(
		filter,
		liked ? { $addToSet: { likes: userId } } : { $pull: { likes: userId } },
		{ returnDocument: 'after', projection: { likes: 1 } }
	);
	return article ? getArticleLikeSummary(article.likes, userId) : null;
}
