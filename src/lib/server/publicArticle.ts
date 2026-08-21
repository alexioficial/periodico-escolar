import type { ArticleWithUrls } from './articles';

/**
 * DTO público explícito. Mantener una whitelist evita que campos privados
 * añadidos al documento de Mongo se filtren por un futuro object spread.
 */
export function toPublicArticle(article: ArticleWithUrls) {
	if (!article._id) throw new Error('El artículo público no tiene ID');
	return {
		_id: article._id.toString(),
		title: article.title,
		content: article.content,
		excerpt: article.excerpt,
		categoryId: article.categoryId,
		authorUsername: article.authorUsername,
		createdAt: article.createdAt,
		publishedAt: article.publishedAt,
		media: article.media,
		attachments: article.attachments
	};
}
