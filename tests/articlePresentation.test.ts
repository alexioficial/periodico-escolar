import assert from 'node:assert/strict';
import test from 'node:test';
import { articleImageAlt, formatArticleDate } from '../src/lib/articlePresentation.ts';

test('formatArticleDate usa un formato español estable', () => {
	assert.equal(formatArticleDate('2026-08-20T23:30:00.000Z'), '20/8/2026');
	assert.equal(formatArticleDate(undefined), '');
	assert.equal(formatArticleDate('fecha inválida'), '');
});

test('articleImageAlt describe una imagen única y la posición en una galería', () => {
	assert.equal(articleImageAlt('Noticia escolar', 0, 1), 'Imagen del artículo «Noticia escolar»');
	assert.equal(
		articleImageAlt('Noticia escolar', 1, 3),
		'Imagen 2 de 3 del artículo «Noticia escolar»'
	);
});
