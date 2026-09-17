import assert from 'node:assert/strict';
import test from 'node:test';
import * as richTextModule from '../src/lib/server/articleRichText.ts';

test('rechaza JSON original superior al límite aunque espacios o escapes se reduzcan al parsear', () => {
	const doc = JSON.stringify({
		version: 1,
		doc: {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(45_000) }] }]
		}
	});
	for (const submitted of [' '.repeat(250_000) + doc, doc.replaceAll('a', '\\u0061')]) {
		assert.throws(() => richTextModule.parseSubmittedArticleContent('', submitted), /bytes/);
	}
});

const richText = richTextModule as typeof richTextModule & {
	validateArticleRichText(value: unknown): {
		version: 1;
		doc: unknown;
		text: string;
		html: string;
	};
	prepareArticleContent(
		content: unknown,
		contentRich?: unknown
	): {
		content: string;
		contentRich?: { version: 1; doc: unknown };
	};
	parseSubmittedArticleContent(
		content: unknown,
		contentRichJson: unknown
	): {
		content: string;
		contentRich?: { version: 1; doc: unknown };
	};
	toArticleContentPresentation<T extends { content: string; contentRich?: unknown }>(
		article: T
	): Omit<T, 'contentRich'> & { contentHtml: string };
	stripClientArticleHtml<T extends object>(article: T): Omit<T, 'contentHtml'>;
};

test('valida, normaliza y renderiza el formato enriquecido permitido', () => {
	const result = richText.validateArticleRichText({
		version: 1,
		doc: {
			type: 'doc',
			content: [
				{
					type: 'heading',
					attrs: { level: 2 },
					content: [{ type: 'text', text: 'Titular', marks: [{ type: 'bold' }] }]
				},
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Lee ' },
						{
							type: 'text',
							text: 'la nota',
							marks: [
								{ type: 'italic' },
								{
									type: 'link',
									attrs: {
										href: ' https://example.com/noticia?q=1 ',
										target: '_self',
										rel: 'opener',
										class: 'externo'
									}
								}
							]
						},
						{ type: 'hardBreak' },
						{ type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'strike' }] }
					]
				}
			]
		}
	});

	assert.equal(result.text, 'Titular\nLee la nota\n<script>alert(1)</script>');
	assert.deepEqual(result.doc, {
		type: 'doc',
		content: [
			{
				type: 'heading',
				attrs: { level: 2 },
				content: [{ type: 'text', text: 'Titular', marks: [{ type: 'bold' }] }]
			},
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: 'Lee ' },
					{
						type: 'text',
						text: 'la nota',
						marks: [
							{ type: 'italic' },
							{ type: 'link', attrs: { href: 'https://example.com/noticia?q=1' } }
						]
					},
					{ type: 'hardBreak' },
					{ type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'strike' }] }
				]
			}
		]
	});
	assert.equal(
		result.html,
		'<h2><strong>Titular</strong></h2><p>Lee <a href="https://example.com/noticia?q=1" target="_blank" rel="noopener noreferrer ugc nofollow"><em>la nota</em></a><br><s>&lt;script&gt;alert(1)&lt;/script&gt;</s></p>'
	);
});

test('renderiza citas y listas anidadas usando únicamente la allowlist', () => {
	const result = richText.validateArticleRichText({
		version: 1,
		doc: {
			type: 'doc',
			content: [
				{
					type: 'blockquote',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cita' }] }]
				},
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								{ type: 'paragraph', content: [{ type: 'text', text: 'Uno' }] },
								{
									type: 'orderedList',
									attrs: { start: 3, type: 'A' },
									content: [
										{
											type: 'listItem',
											content: [
												{
													type: 'paragraph',
													content: [
														{
															type: 'text',
															text: 'Dos',
															marks: [{ type: 'link', attrs: { href: '/interno?x=1#parte' } }]
														}
													]
												}
											]
										}
									]
								}
							]
						}
					]
				}
			]
		}
	});

	assert.equal(result.text, 'Cita\nUno\nDos');
	assert.equal(
		result.html,
		'<blockquote><p>Cita</p></blockquote><ul><li><p>Uno</p><ol><li><p><a href="/interno?x=1#parte" target="_blank" rel="noopener noreferrer ugc nofollow">Dos</a></p></li></ol></li></ul>'
	);
	const normalizedOrderedList = result.doc.content?.[1]?.content?.[0]?.content?.[1];
	assert.equal('attrs' in (normalizedOrderedList ?? {}), false);
});

test('rechaza versiones, nodos, marcas, atributos y estructuras desconocidas', () => {
	const invalidDocuments = [
		{ version: 2, doc: { type: 'doc', content: [] } },
		{ version: 1, extra: true, doc: { type: 'doc', content: [] } },
		{ version: 1, doc: { type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] } },
		{
			version: 1,
			doc: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						attrs: { style: 'color:red' },
						content: [{ type: 'text', text: 'Texto' }]
					}
				]
			}
		},
		{
			version: 1,
			doc: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'Texto', marks: [{ type: 'code' }] }]
					}
				]
			}
		},
		{
			version: 1,
			doc: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'Texto', marks: [{ type: 'bold', attrs: { onclick: 'x' } }] }
						]
					}
				]
			}
		},
		{
			version: 1,
			doc: {
				type: 'doc',
				content: [{ type: 'text', text: 'Fuera de un bloque' }]
			}
		},
		{
			version: 1,
			doc: {
				type: 'doc',
				content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'H1' }] }]
			}
		}
	];

	for (const value of invalidDocuments) {
		assert.throws(() => richText.validateArticleRichText(value));
	}
});

test('rechaza documentos sin texto visible', () => {
	for (const value of [
		null,
		{},
		{ version: 1, doc: { type: 'doc', content: [] } },
		{
			version: 1,
			doc: {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: ' \n\t ' }] }]
			}
		}
	]) {
		assert.throws(() => richText.validateArticleRichText(value));
	}
});

test('rechaza enlaces peligrosos, relativos no-root, malformados o con credenciales', () => {
	const invalidLinks = [
		'javascript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'//evil.example/path',
		'/\\evil.example/path',
		'relativo/sin-raiz',
		'https://user:password@example.com/',
		'http://[::1',
		`https://example.com/${'a'.repeat(2050)}`
	];

	for (const href of invalidLinks) {
		assert.throws(() =>
			richText.validateArticleRichText({
				version: 1,
				doc: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [
								{ type: 'text', text: 'Enlace', marks: [{ type: 'link', attrs: { href } }] }
							]
						}
					]
				}
			})
		);
	}
});

test('aplica límites de texto, bytes, nodos y profundidad', () => {
	assert.throws(
		() =>
			richText.validateArticleRichText({
				version: 1,
				doc: {
					type: 'doc',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(50_001) }] }]
				}
			}),
		/50[ .]?000|texto/i
	);

	assert.throws(
		() =>
			richText.validateArticleRichText({
				version: 1,
				doc: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: Array.from({ length: 9_000 }, () => ({ type: 'text', text: 'xx' }))
						}
					]
				}
			}),
		/250[ .]?000|bytes/i
	);

	assert.throws(
		() =>
			richText.validateArticleRichText({
				version: 1,
				doc: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [
								{ type: 'text', text: 'visible' },
								...Array.from({ length: 10_000 }, () => ({ type: 'hardBreak' }))
							]
						}
					]
				}
			}),
		/10[ .]?000|nodos/i
	);

	let nested: unknown = { type: 'paragraph', content: [{ type: 'text', text: 'Profundo' }] };
	for (let index = 0; index < 20; index += 1) {
		nested = { type: 'blockquote', content: [nested] };
	}
	assert.throws(
		() =>
			richText.validateArticleRichText({
				version: 1,
				doc: { type: 'doc', content: [nested] }
			}),
		/20|profundidad/i
	);
});

test('deriva el texto persistido y descarta el content enviado junto al JSON', () => {
	const submitted = richText.parseSubmittedArticleContent(
		'<script>texto controlado por el cliente</script>',
		JSON.stringify({
			version: 1,
			doc: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'Texto confiable' }]
					}
				]
			}
		})
	);

	assert.equal(submitted.content, 'Texto confiable');
	assert.equal(submitted.contentRich?.version, 1);
	assert.equal('html' in submitted, false);

	const revalidated = richText.prepareArticleContent('texto manipulado', submitted.contentRich);
	assert.equal(revalidated.content, 'Texto confiable');
});

test('mantiene publicaciones legacy y rechaza JSON enviado malformado', () => {
	assert.deepEqual(richText.parseSubmittedArticleContent('  Texto legacy\nsegunda  ', null), {
		content: 'Texto legacy\nsegunda'
	});
	assert.throws(
		() => richText.parseSubmittedArticleContent('ignorado', '{"version":1'),
		/JSON|inválido/i
	);
	assert.throws(() => richText.parseSubmittedArticleContent('', null), /contenido|texto/i);
	assert.throws(
		() => richText.parseSubmittedArticleContent('x'.repeat(50_001), null),
		/50[ .]?000/i
	);
});

test('la presentación para loads privados conserva metadatos pero elimina contentRich', () => {
	const presented = richText.toArticleContentPresentation({
		content: 'derivado',
		contentRich: {
			version: 1,
			doc: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'Privado seguro' }]
					}
				]
			}
		},
		status: 'pending',
		authorId: 'autor'
	});

	assert.equal(presented.contentHtml, '<p>Privado seguro</p>');
	assert.equal(presented.status, 'pending');
	assert.equal(presented.authorId, 'autor');
	assert.equal('contentRich' in presented, false);
});

test('el documento de persistencia descarta cualquier HTML proporcionado por el cliente', () => {
	const safe = richText.stripClientArticleHtml({
		title: 'Título',
		content: 'Texto',
		contentHtml: '<img src=x onerror=alert(1)>'
	});

	assert.deepEqual(safe, { title: 'Título', content: 'Texto' });
	assert.equal('contentHtml' in safe, false);
});
