import { ObjectId, type Collection } from 'mongodb';
import type { ArticleDoc } from './articles';
import { prepareArticleContent } from './articleRichText';

type OwnCollection = Pick<Collection<ArticleDoc>, 'findOne' | 'updateOne' | 'findOneAndDelete'>;
type Role = 'user' | 'admin' | 'superadmin';
export class OwnArticleValidationError extends Error {}

export function validateOwnArticleFields(fields: Record<string, unknown>) {
	const title = typeof fields.title === 'string' ? fields.title.trim() : '';
	const excerpt = typeof fields.excerpt === 'string' ? fields.excerpt.trim() : '';
	const categoryId = typeof fields.categoryId === 'string' ? fields.categoryId.trim() : '';
	if (!title || title.length > 200)
		throw new OwnArticleValidationError('El título debe contener entre 1 y 200 caracteres');
	if (!excerpt || excerpt.length > 500)
		throw new OwnArticleValidationError('El extracto debe contener entre 1 y 500 caracteres');
	if (!/^[a-f\d]{24}$/i.test(categoryId))
		throw new OwnArticleValidationError('La categoría seleccionada no es válida');
	try {
		return {
			title,
			excerpt,
			categoryId,
			...prepareArticleContent(fields.content, fields.contentRich)
		};
	} catch (error) {
		throw new OwnArticleValidationError(
			error instanceof Error ? error.message : 'El contenido no es válido'
		);
	}
}

export function ownArticleFilter(id: unknown, authorId: unknown) {
	if (
		typeof id !== 'string' ||
		!/^[a-f\d]{24}$/i.test(id) ||
		typeof authorId !== 'string' ||
		!authorId
	)
		return null;
	return { _id: new ObjectId(id), authorId };
}

export async function getOwnArticle(collection: OwnCollection, id: unknown, authorId: unknown) {
	const filter = ownArticleFilter(id, authorId);
	return filter ? collection.findOne(filter) : null;
}

/** Persistence boundary: never spread submitted metadata; revalidate rich JSON. */
export async function updateOwnArticle(
	collection: OwnCollection,
	id: string,
	authorId: string,
	role: Role,
	fields: Record<string, unknown>,
	now = new Date()
): Promise<boolean> {
	const filter = ownArticleFilter(id, authorId);
	if (!filter) return false;
	const { title, excerpt, categoryId, ...content } = validateOwnArticleFields(fields);
	const staff = role === 'admin' || role === 'superadmin';
	// Pipeline reads the publication timestamp atomically; $literal prevents text
	// beginning with "$" being evaluated as a Mongo expression.
	const result = await collection.updateOne(filter, [
		{
			$set: {
				title: { $literal: title },
				excerpt: { $literal: excerpt },
				categoryId: { $literal: categoryId },
				content: { $literal: content.content },
				contentRich: content.contentRich ? { $literal: content.contentRich } : '$$REMOVE',
				status: staff ? 'published' : 'pending',
				updatedAt: now,
				rejectionReason: '$$REMOVE',
				revision: { $add: [{ $ifNull: ['$revision', 0] }, 1] },
				publishedAt: staff
					? { $cond: [{ $eq: ['$status', 'published'] }, { $ifNull: ['$publishedAt', now] }, now] }
					: '$$REMOVE'
			}
		}
	]);
	return result.matchedCount === 1;
}

/** Only this server-deleted owned record may supply storage cleanup keys. */
export async function deleteOwnArticle(collection: OwnCollection, id: string, authorId: string) {
	const filter = ownArticleFilter(id, authorId);
	return filter ? collection.findOneAndDelete(filter) : null;
}
