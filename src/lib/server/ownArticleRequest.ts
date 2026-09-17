import { ObjectId, type Collection, type Document } from 'mongodb';
import type { ArticleDoc } from './articles';
import { parseSubmittedArticleContent, prepareArticleContent } from './articleRichText';
import {
	deleteOwnArticle,
	getOwnArticle,
	updateOwnArticle,
	validateOwnArticleFields,
	OwnArticleValidationError
} from './ownArticleManagement';
import type { RateLimitOptions, RateLimitResult } from './rateLimit';

interface Dependencies {
	articles: Pick<Collection<ArticleDoc>, 'findOne' | 'updateOne' | 'findOneAndDelete'>;
	users: { findOne(filter: { _id: ObjectId }): Promise<Document | null> };
	categories: { findOne(filter: { _id: ObjectId }): Promise<Document | null> };
	checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult>;
	deleteFile(key: string): Promise<void>;
	logCleanupFailure(key: string, error: unknown): void;
	logMutationFailure?(error: unknown): void;
	now?: () => Date;
}
export interface OwnMutationResult {
	status: number;
	message: string;
	cleanupFailed?: boolean;
	draft?: {
		title: string;
		excerpt: string;
		categoryId: string;
		content: string;
		contentRich: string;
	};
}

/** Session identity only; account and ownership checked before reading submitted edits. */
export async function handleOwnArticleMutation(
	request: Request,
	user: { _id: string } | null,
	id: string,
	operation: 'edit' | 'delete',
	deps: Dependencies
): Promise<OwnMutationResult> {
	if (!user || !/^[a-f\d]{24}$/i.test(user._id)) return { status: 401, message: 'No autorizado' };
	let account: Document | null;
	let existing: ArticleDoc;
	try {
		account = await deps.users.findOne({ _id: new ObjectId(user._id) });
		if (!account) return { status: 401, message: 'Sesión inválida. Vuelve a iniciar sesión.' };
		if (account.provider === 'credentials' && account.emailVerified !== true)
			return { status: 403, message: 'Verifica tu correo antes de modificar artículos.' };
		const owned = await getOwnArticle(deps.articles, id, user._id);
		if (!owned) return { status: 404, message: 'Artículo no encontrado' };
		existing = owned;
	} catch (error) {
		(deps.logMutationFailure ?? console.error)(error);
		return {
			status: 500,
			message: 'No se pudo verificar el artículo o la cuenta. Intenta de nuevo.'
		};
	}
	let draft: OwnMutationResult['draft'];
	if (operation === 'edit') {
		let form: FormData;
		try {
			form = await request.formData();
		} catch {
			return { status: 400, message: 'Formulario inválido' };
		}
		const text = (name: string) => {
			const value = form.get(name);
			return typeof value === 'string' ? value : '';
		};
		draft = {
			title: text('title'),
			excerpt: text('excerpt'),
			categoryId: text('categoryId'),
			content: text('content'),
			contentRich: text('contentRich')
		};
		if (!draft.contentRich && existing.contentRich) {
			try {
				const stored = prepareArticleContent(existing.content, existing.contentRich);
				if (draft.content.replace(/\r\n?/g, '\n') === stored.content.replace(/\r\n?/g, '\n')) {
					// Internal normalized draft only: the action turns this into safe HTML
					// and never exposes rich JSON. Keep formatting even on429/400/500,
					// so hydrating the failed form cannot erase it on the next save.
					draft.contentRich = JSON.stringify(stored.contentRich);
				}
			} catch (error) {
				(deps.logMutationFailure ?? console.error)(error);
				return {
					status: 500,
					message: 'No se pudo preparar el contenido existente. Tu borrador se conserva.',
					draft
				};
			}
		}
	}
	let limit: RateLimitResult;
	try {
		limit = await deps.checkRateLimit({
			key: `article-modify:${user._id}`,
			limit: 30,
			windowMs: 600_000,
			onError: 'closed'
		});
	} catch {
		return {
			status: 429,
			message: 'No se pudo verificar el límite de modificaciones. Intenta de nuevo más tarde.',
			draft
		};
	}
	if (!limit.ok)
		return {
			status: 429,
			message: `Has alcanzado el límite de modificaciones. Intenta de nuevo en ${limit.retryAfter}s.`,
			draft
		};
	if (operation === 'delete') {
		let deleted;
		try {
			deleted = await deleteOwnArticle(deps.articles, id, user._id);
		} catch (error) {
			(deps.logMutationFailure ?? console.error)(error);
			return { status: 500, message: 'No se pudo eliminar el artículo. Intenta de nuevo.' };
		}
		if (!deleted) return { status: 404, message: 'Artículo no encontrado' };
		const keys = [
			...new Set([...(deleted.media ?? []), ...(deleted.attachments ?? [])].map((file) => file.key))
		];
		let cleanupFailed = false;
		await Promise.all(
			keys.map(async (key) => {
				try {
					await deps.deleteFile(key);
				} catch (error) {
					cleanupFailed = true;
					deps.logCleanupFailure(key, error);
				}
			})
		);
		return {
			status: 200,
			cleanupFailed,
			message: cleanupFailed
				? 'Artículo eliminado. No se pudo completar la limpieza de algunos archivos.'
				: 'Artículo eliminado correctamente'
		};
	}
	if (!draft) return { status: 400, message: 'Formulario inválido' };
	let fields: ReturnType<typeof validateOwnArticleFields>;
	try {
		let content;
		if (!draft.contentRich && existing.contentRich) {
			// Without JS the fallback textarea posts plain text but the rich hidden
			// field is empty. Reuse only our author-filtered, revalidated stored doc
			// when visible text is unchanged; never silently erase its formatting.
			content = prepareArticleContent(existing.content, existing.contentRich);
			const newlineText = (text: string) => text.replace(/\r\n?/g, '\n');
			if (newlineText(draft.content) !== newlineText(content.content)) {
				throw new OwnArticleValidationError(
					'Para cambiar el texto de este artículo con formato, activa JavaScript y usa el editor visual. Tu borrador se conserva.'
				);
			}
		} else {
			content = parseSubmittedArticleContent(draft.content, draft.contentRich);
		}
		fields = validateOwnArticleFields({
			title: draft.title,
			excerpt: draft.excerpt,
			categoryId: draft.categoryId,
			...content
		});
	} catch (error) {
		return {
			status: 400,
			message: error instanceof Error ? error.message : 'El contenido no es válido',
			draft
		};
	}
	try {
		if (!(await deps.categories.findOne({ _id: new ObjectId(fields.categoryId) })))
			return { status: 400, message: 'La categoría seleccionada no existe', draft };
		const role = account.role === 'admin' || account.role === 'superadmin' ? account.role : 'user';
		const updated = await updateOwnArticle(deps.articles, id, user._id, role, fields, deps.now?.());
		return updated
			? {
					status: 200,
					message:
						role === 'user' ? 'Artículo enviado a revisión' : 'Artículo publicado correctamente'
				}
			: { status: 404, message: 'Artículo no encontrado', draft };
	} catch (error) {
		if (error instanceof OwnArticleValidationError)
			return { status: 400, message: error.message, draft };
		(deps.logMutationFailure ?? console.error)(error);
		return {
			status: 500,
			message: 'No se pudieron guardar los cambios. Tu borrador se conserva; intenta de nuevo.',
			draft
		};
	}
}
