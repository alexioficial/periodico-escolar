import { type Db, ObjectId } from 'mongodb';
import { getDb } from './db';
import { getViewUrl, getDownloadUrl } from './storage';

const ARTICLES_COLLECTION = 'articles';

export interface ArticleMedia {
	type: 'image' | 'video';
	key: string;
	mimeType: string;
}

export interface ArticleAttachment {
	name: string;
	key: string;
	size: number;
	mimeType: string;
}

export interface ArticleDoc {
	_id?: ObjectId;
	title: string;
	content: string;
	excerpt: string;
	categoryId: string;
	authorId: string;
	authorEmail: string;
	status: 'draft' | 'pending' | 'published' | 'rejected';
	createdAt: Date;
	publishedAt?: Date;

	media?: ArticleMedia[];
	attachments?: ArticleAttachment[];

	likes?: string[];
	savedBy?: string[];
}

/**
 * Tipo del artículo tal como se expone al cliente:
 * `media[].key` y `attachments[].key` se reemplazan por `url` firmada.
 */
export type ArticleWithUrls<T extends ArticleDoc = ArticleDoc> = Omit<
	T,
	'media' | 'attachments'
> & {
	media?: { type: 'image' | 'video'; url: string; mimeType: string }[];
	attachments?: { name: string; url: string; size: number; mimeType: string }[];
};

export async function enrichArticleWithUrls<T extends ArticleDoc>(
	article: T
): Promise<ArticleWithUrls<T>> {
	const [media, attachments] = await Promise.all([
		Promise.all(
			(article.media ?? []).map(async (m) => ({
				type: m.type,
				url: await getViewUrl(m.key),
				mimeType: m.mimeType
			}))
		),
		Promise.all(
			(article.attachments ?? []).map(async (a) => ({
				name: a.name,
				url: await getDownloadUrl(a.key, a.name),
				size: a.size,
				mimeType: a.mimeType
			}))
		)
	]);

	return { ...article, media, attachments };
}

export async function enrichArticlesWithUrls<T extends ArticleDoc>(
	articles: T[]
): Promise<ArticleWithUrls<T>[]> {
	return Promise.all(articles.map(enrichArticleWithUrls));
}

export async function createArticle(article: Omit<ArticleDoc, '_id' | 'createdAt'>) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);

	const result = await collection.insertOne({
		...article,
		createdAt: new Date(),
		likes: [],
		savedBy: []
	});

	return result.insertedId;
}

export async function getPendingArticles() {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	return collection.find({ status: 'pending' }).sort({ createdAt: -1 }).toArray();
}

export async function getPublishedArticles(categoryId?: string, skip = 0, limit?: number) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const query: { status: ArticleDoc['status']; categoryId?: string } = { status: 'published' };
	if (categoryId) {
		query.categoryId = categoryId;
	}

	let cursor = collection.find(query).sort({ publishedAt: -1 }).skip(skip);
	if (limit) {
		cursor = cursor.limit(limit);
	}

	return cursor.toArray();
}

export async function countPublishedArticles(categoryId?: string) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const query: { status: ArticleDoc['status']; categoryId?: string } = { status: 'published' };
	if (categoryId) {
		query.categoryId = categoryId;
	}
	return collection.countDocuments(query);
}

export async function getArticlesByAuthor(authorId: string) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	return collection.find({ authorId }).sort({ createdAt: -1 }).toArray();
}

/**
 * Cambia el status de un artículo. Solo aplica si el artículo está en
 * `status: 'pending'`. Retorna true si la transición se aplicó.
 *
 * Esto evita que un admin re-apruebe artículos ya rechazados o re-rechace
 * publicados pasando IDs arbitrarios.
 */
export async function updateArticleStatus(
	id: string,
	status: ArticleDoc['status']
): Promise<boolean> {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);

	const update: { status: ArticleDoc['status']; publishedAt?: Date } = { status };
	if (status === 'published') {
		update.publishedAt = new Date();
	}

	const result = await collection.updateOne(
		{ _id: new ObjectId(id), status: 'pending' },
		{ $set: update }
	);
	return result.matchedCount === 1;
}

export async function getArticleById(id: string) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	return collection.findOne({ _id: new ObjectId(id) });
}

export async function toggleLike(articleId: string, userId: string) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const article = await collection.findOne({ _id: new ObjectId(articleId) });

	if (!article) return;

	const likes = article.likes || [];
	const isLiked = likes.includes(userId);

	if (isLiked) {
		await collection.updateOne({ _id: new ObjectId(articleId) }, { $pull: { likes: userId } });
	} else {
		await collection.updateOne({ _id: new ObjectId(articleId) }, { $addToSet: { likes: userId } });
	}
}

export async function toggleSave(articleId: string, userId: string) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const article = await collection.findOne({ _id: new ObjectId(articleId) });

	if (!article) return;

	const savedBy = article.savedBy || [];
	const isSaved = savedBy.includes(userId);

	if (isSaved) {
		await collection.updateOne({ _id: new ObjectId(articleId) }, { $pull: { savedBy: userId } });
	} else {
		await collection.updateOne(
			{ _id: new ObjectId(articleId) },
			{ $addToSet: { savedBy: userId } }
		);
	}
}

export async function getSavedArticles(userId: string) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	return collection
		.find({ savedBy: userId, status: 'published' })
		.sort({ publishedAt: -1 })
		.toArray();
}
