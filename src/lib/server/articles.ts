import { type Db, ObjectId } from 'mongodb';
import { getDb } from './db';

const ARTICLES_COLLECTION = 'articles';

export interface ArticleDoc {
    _id?: ObjectId;
    title: string;
    content: string;
    excerpt: string;
    category: string;
    authorId: string;
    authorEmail: string;
    status: 'draft' | 'pending' | 'published' | 'rejected';
    createdAt: Date;
    publishedAt?: Date;

    // Rich Media
    media?: {
        type: 'image' | 'video';
        url: string;
        mimeType: string;
    }[];
    attachments?: {
        name: string;
        url: string;
        size: number;
        mimeType: string;
    }[];

    // Social
    likes?: string[]; // Array of User IDs
    savedBy?: string[]; // Array of User IDs
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

export async function getPublishedArticles(category?: string) {
    const db: Db = await getDb();
    const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
    const query: any = { status: 'published' };
    if (category) {
        query.category = category;
    }
    return collection.find(query).sort({ publishedAt: -1 }).toArray();
}

export async function getArticlesByAuthor(authorId: string) {
    const db: Db = await getDb();
    const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
    return collection.find({ authorId }).sort({ createdAt: -1 }).toArray();
}

export async function updateArticleStatus(id: string, status: ArticleDoc['status']) {
    const db: Db = await getDb();
    const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);

    const update: any = { status };
    if (status === 'published') {
        update.publishedAt = new Date();
    }

    await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
    );
}

export async function getArticleById(id: string) {
    const db: Db = await getDb();
    const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
    return collection.findOne({ _id: new ObjectId(id) });
}

// Social Interactions
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
        await collection.updateOne({ _id: new ObjectId(articleId) }, { $addToSet: { savedBy: userId } });
    }
}

export async function getSavedArticles(userId: string) {
    const db: Db = await getDb();
    const collection = db.collection<ArticleDoc>(ARTICLES_COLLECTION);
    return collection.find({ savedBy: userId, status: 'published' }).sort({ publishedAt: -1 }).toArray();
}
