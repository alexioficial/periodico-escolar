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
});
