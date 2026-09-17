import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArticleWithUrls } from '../src/lib/server/articles.ts';
import { toPublicArticle } from '../src/lib/server/publicArticle.ts';

test('el DTO público excluye identidad y reacciones privadas', () => {
	const article = {
		_id: { toString: () => 'article-id' },
		title: 'Título',
		content: 'Contenido',
		excerpt: 'Extracto',
		categoryId: 'category-id',
		authorId: 'private-user-id',
		authorEmail: 'private@example.com',
		authorUsername: 'autor',
		status: 'published',
		createdAt: new Date(),
		likes: ['private-user-id'],
		savedBy: ['another-private-user-id']
	} as unknown as ArticleWithUrls;

	const result = toPublicArticle(article);
	assert.equal(result._id, 'article-id');
	assert.equal('authorId' in result, false);
	assert.equal('authorEmail' in result, false);
	assert.equal('likes' in result, false);
	assert.equal('savedBy' in result, false);
	assert.equal('contentRich' in result, false);
	assert.equal(result.contentHtml, 'Contenido');
});

test('el DTO público escapa artículos legacy y conserva sus saltos de línea', () => {
	const article = {
		_id: { toString: () => 'legacy-id' },
		title: 'Legacy',
		content: '<img src=x onerror=alert(1)>\nSegunda línea',
		excerpt: 'Extracto',
		categoryId: 'category-id',
		authorId: 'private-user-id',
		authorEmail: 'private@example.com',
		status: 'published',
		createdAt: new Date()
	} as unknown as ArticleWithUrls;

	const result = toPublicArticle(article);
	assert.equal(result.contentHtml, '&lt;img src=x onerror=alert(1)&gt;<br>Segunda línea');
});

test('el DTO público genera HTML desde JSON validado y nunca expone contentRich', () => {
	const article = {
		_id: { toString: () => 'rich-id' },
		title: 'Enriquecido',
		content: 'Texto derivado',
		contentRich: {
			version: 1,
			doc: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'Seguro', marks: [{ type: 'bold' }] }]
					}
				]
			}
		},
		excerpt: 'Extracto',
		categoryId: 'category-id',
		authorId: 'private-user-id',
		authorEmail: 'private@example.com',
		status: 'published',
		createdAt: new Date()
	} as unknown as ArticleWithUrls;

	const result = toPublicArticle(article);
	assert.equal(result.contentHtml, '<p><strong>Seguro</strong></p>');
	assert.equal('contentRich' in result, false);
});
