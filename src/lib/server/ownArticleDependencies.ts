import { getDb } from './db';
import type { ArticleDoc } from './articles';
import { checkRateLimit } from './rateLimit';
import { deleteFile } from './storage';

export async function ownArticleDependencies() {
	const db = await getDb();
	return {
		articles: db.collection<ArticleDoc>('articles'),
		users: db.collection('users'),
		categories: db.collection('categories'),
		checkRateLimit,
		deleteFile: (key: string) => deleteFile(key, { throwOnError: true }),
		logCleanupFailure: (key: string, error: unknown) =>
			console.error('Owned article removed; storage cleanup failed:', key, error)
	};
}
