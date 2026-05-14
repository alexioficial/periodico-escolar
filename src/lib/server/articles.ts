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
	// Snapshot del username/nombre visible al momento de publicar. Se prefiere
	// sobre `authorEmail` al renderizar para no filtrar correos en feed público.
	authorUsername?: string;
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

// Topes de longitud para no inflar la DB ni romper la UI con contenido enorme.
export const TITLE_MAX = 200;
export const EXCERPT_MAX = 500;
export const CONTENT_MAX = 50_000;

export async function createArticle(article: Omit<ArticleDoc, '_id' | 'createdAt'>) {
	if (typeof article.title !== 'string' || article.title.length > TITLE_MAX) {
		throw new Error(`El título supera los ${TITLE_MAX} caracteres`);
	}
	if (typeof article.excerpt !== 'string' || article.excerpt.length > EXCERPT_MAX) {
		throw new Error(`El extracto supera los ${EXCERPT_MAX} caracteres`);
	}
	if (typeof article.content !== 'string' || article.content.length > CONTENT_MAX) {
		throw new Error(`El contenido supera los ${CONTENT_MAX} caracteres`);
	}

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

// Tope absoluto de paginación. Sin esto, un caller que pase `limit: 999999`
// puede cargar la colección entera y degradar Mongo.
const MAX_PAGE_LIMIT = 100;

export async function getPublishedArticles(categoryId?: string, skip = 0, limit?: number) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const query: { status: ArticleDoc['status']; categoryId?: string } = { status: 'published' };
	if (typeof categoryId === 'string' && categoryId) {
		query.categoryId = categoryId;
	}

	const safeSkip = Math.max(0, Math.floor(Number(skip) || 0));
	let cursor = collection.find(query).sort({ publishedAt: -1 }).skip(safeSkip);
	if (limit) {
		cursor = cursor.limit(Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(Number(limit)))));
	}

	return cursor.toArray();
}

export async function countPublishedArticles(categoryId?: string) {
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const query: { status: ArticleDoc['status']; categoryId?: string } = { status: 'published' };
	if (typeof categoryId === 'string' && categoryId) {
		query.categoryId = categoryId;
	}
	return collection.countDocuments(query);
}

export async function getArticlesByAuthor(authorId: string) {
	if (typeof authorId !== 'string') return [];
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
// Sólo whitelisteamos estos status como destino. Sin esto, un caller podría
// pasar `'draft'` u otro valor y rescatar artículos del flujo de moderación.
const REVIEWABLE_STATUS = new Set<ArticleDoc['status']>(['published', 'rejected']);

export async function updateArticleStatus(
	id: string,
	status: ArticleDoc['status']
): Promise<boolean> {
	if (typeof id !== 'string' || !ObjectId.isValid(id)) return false;
	if (!REVIEWABLE_STATUS.has(status)) return false;

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
	if (typeof id !== 'string' || !ObjectId.isValid(id)) return null;
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	return collection.findOne({ _id: new ObjectId(id) });
}

export async function toggleLike(articleId: string, userId: string) {
	if (typeof articleId !== 'string' || !ObjectId.isValid(articleId)) return;
	if (typeof userId !== 'string' || !userId) return;

	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const _id = new ObjectId(articleId);
	// Sólo permitimos like sobre artículos publicados — drafts/pending/rejected
	// no son alcanzables por nadie excepto su autor o los moderadores.
	const article = await collection.findOne({ _id, status: 'published' });

	if (!article) return;

	const isLiked = (article.likes ?? []).includes(userId);

	if (isLiked) {
		await collection.updateOne({ _id, status: 'published' }, { $pull: { likes: userId } });
	} else {
		await collection.updateOne(
			{ _id, status: 'published' },
			{ $addToSet: { likes: userId } }
		);
	}
}

export async function toggleSave(articleId: string, userId: string) {
	if (typeof articleId !== 'string' || !ObjectId.isValid(articleId)) return;
	if (typeof userId !== 'string' || !userId) return;

	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	const _id = new ObjectId(articleId);
	const article = await collection.findOne({ _id, status: 'published' });

	if (!article) return;

	const isSaved = (article.savedBy ?? []).includes(userId);

	if (isSaved) {
		await collection.updateOne({ _id, status: 'published' }, { $pull: { savedBy: userId } });
	} else {
		await collection.updateOne(
			{ _id, status: 'published' },
			{ $addToSet: { savedBy: userId } }
		);
	}
}

export async function getSavedArticles(userId: string) {
	if (typeof userId !== 'string' || !userId) return [];
	const db: Db = await getDb();
	const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
	return collection
		.find({ savedBy: userId, status: 'published' })
		.sort({ publishedAt: -1 })
		.toArray();
}
