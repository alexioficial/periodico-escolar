import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import type { ArticleDoc } from '../src/lib/server/articles.ts';

import * as management from '../src/lib/server/ownArticleManagement.ts';
import * as boundary from '../src/lib/server/ownArticleRequest.ts';
import * as moderation from '../src/lib/server/ownArticleModeration.ts';
const authorId = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';
const categoryId = '507f1f77bcf86cd799439013';
const now = new Date('2026-09-17T12:00:00Z');
const old = new Date('2026-01-01T00:00:00Z');

test('real Mongo enforces ownership, moderation, preservation and deleted-record cleanup', async (t) => {
	assert.equal(typeof management.updateOwnArticle, 'function');
	const mongo = await MongoMemoryServer.create({
		binary: { downloadDir: resolve('.svelte-kit/smoke-mongo') },
		instance: { ip: '127.0.0.1' }
	});
	const client = await new MongoClient(mongo.getUri()).connect();
	const db = client.db('own_article_test');
	const articles = db.collection<ArticleDoc>('articles');
	await db.collection('categories').insertOne({ _id: new ObjectId(categoryId) });
	const seed = async (role: string, status: ArticleDoc['status'] = 'published') => {
		const article: ArticleDoc = {
			title: 'Original',
			content: 'Viejo',
			excerpt: 'Resumen',
			categoryId,
			authorId,
			authorEmail: 'own@test.local',
			authorUsername: 'Autor',
			status,
			createdAt: old,
			publishedAt: old,
			rejectionReason: 'Anterior',
			views: 12,
			likes: [otherId],
			savedBy: [otherId],
			media: [{ key: 'owned-image', type: 'image', mimeType: 'image/png' }],
			attachments: [{ key: 'owned-pdf', name: 'guia.pdf', size: 9, mimeType: 'application/pdf' }]
		};
		const { _id: unused, ...fields } = article;
		void unused;
		const result = await articles.insertOne(fields);
		await db
			.collection('users')
			.updateOne(
				{ _id: new ObjectId(authorId) },
				{ $set: { provider: 'credentials', emailVerified: true, role } },
				{ upsert: true }
			);
		return result.insertedId.toHexString();
	};
	const deps = {
		articles,
		categories: db.collection('categories'),
		users: db.collection('users'),
		checkRateLimit: async () => ({ ok: true, remaining: 29, retryAfter: 0 }),
		deleteFile: async (key: string) => {
			cleaned.push(key);
		},
		logCleanupFailure: (_key: string, _error: unknown) => {
			void _key;
			void _error;
		},
		now: () => now
	};
	const cleaned: string[] = [];
	const fields = {
		title: '  Nuevo  ',
		excerpt: '  Resumen nuevo  ',
		categoryId,
		content: 'forged plain',
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
		authorId: otherId,
		status: 'published',
		views: 0,
		likes: [],
		savedBy: [],
		media: [],
		attachments: [],
		contentHtml: '<script>evil</script>'
	};
	const request = (extra: Record<string, unknown> = {}) => {
		const form = new FormData();
		for (const [key, value] of Object.entries({ ...fields, ...extra }))
			form.set(key, typeof value === 'string' ? value : JSON.stringify(value));
		return new Request('https://paper.test/redaccion', { method: 'POST', body: form });
	};
	try {
		for (const role of ['user', 'admin', 'superadmin'])
			await t.test(`own update/delete ${role}`, async () => {
				const id = await seed(role);
				assert.equal(
					(await boundary.handleOwnArticleMutation(request(), { _id: authorId }, id, 'edit', deps))
						.status,
					200
				);
				const saved = await articles.findOne({ _id: new ObjectId(id) });
				assert.equal(saved?.title, 'Nuevo');
				assert.equal(saved?.content, 'Seguro');
				assert.equal(saved?.status, role === 'user' ? 'pending' : 'published');
				assert.equal(
					saved?.publishedAt?.toISOString(),
					role === 'user' ? undefined : old.toISOString()
				);
				assert.equal(saved?.updatedAt?.toISOString(), now.toISOString());
				assert.equal(saved?.rejectionReason, undefined);
				assert.equal(saved?.createdAt.toISOString(), old.toISOString());
				assert.equal(saved?.authorId, authorId);
				assert.equal(saved?.authorEmail, 'own@test.local');
				assert.equal(saved?.authorUsername, 'Autor');
				assert.equal(saved?.views, 12);
				assert.deepEqual(saved?.likes, [otherId]);
				assert.deepEqual(saved?.savedBy, [otherId]);
				assert.equal(saved?.media?.[0].key, 'owned-image');
				assert.equal(saved?.attachments?.[0].key, 'owned-pdf');
				assert.equal(saved !== null && 'contentHtml' in saved, false);
				cleaned.length = 0;
				assert.equal(
					(
						await boundary.handleOwnArticleMutation(
							request({ keys: ['foreign-key'] }),
							{ _id: authorId },
							id,
							'delete',
							deps
						)
					).status,
					200
				);
				assert.equal(await articles.findOne({ _id: new ObjectId(id) }), null);
				assert.deepEqual(cleaned.sort(), ['owned-image', 'owned-pdf']);
			});
		for (const role of ['user', 'admin', 'superadmin'])
			await t.test(`foreign/missing/invalid inaccessible to ${role}`, async () => {
				const id = await seed(role);
				const before = await articles.findOne({ _id: new ObjectId(id) });
				for (const operation of ['edit', 'delete'] as const)
					for (const target of [id, 'bad-id', new ObjectId().toHexString()]) {
						cleaned.length = 0;
						assert.equal(
							(
								await boundary.handleOwnArticleMutation(
									request(),
									{ _id: otherId },
									target,
									operation,
									{ ...deps, users: { findOne: async () => ({ provider: 'google', role }) } }
								)
							).status,
							404
						);
						assert.deepEqual(cleaned, []);
					}
				assert.deepEqual(await articles.findOne({ _id: new ObjectId(id) }), before);
			});
		await t.test('anonymous/deleted/unverified accounts cannot modify', async () => {
			const id = await seed('user');
			assert.equal(
				(await boundary.handleOwnArticleMutation(request(), null, id, 'edit', deps)).status,
				401
			);
			assert.equal(
				(await boundary.handleOwnArticleMutation(request(), { _id: otherId }, id, 'delete', deps))
					.status,
				401
			);
			await db
				.collection('users')
				.updateOne({ _id: new ObjectId(authorId) }, { $set: { emailVerified: false } });
			assert.equal(
				(await boundary.handleOwnArticleMutation(request(), { _id: authorId }, id, 'delete', deps))
					.status,
				403
			);
			assert.ok(await articles.findOne({ _id: new ObjectId(id) }));
		});
		await t.test(
			'rejected/draft/pending user edits re-review; staff first publication sets timestamp',
			async () => {
				for (const role of ['user', 'admin', 'superadmin'])
					for (const status of ['rejected', 'draft', 'pending'] as const) {
						const id = await seed(role, status);
						await boundary.handleOwnArticleMutation(request(), { _id: authorId }, id, 'edit', deps);
						const saved = await articles.findOne({ _id: new ObjectId(id) });
						assert.equal(saved?.status, role === 'user' ? 'pending' : 'published');
						assert.equal(
							saved?.publishedAt?.toISOString(),
							role === 'user' ? undefined : now.toISOString()
						);
					}
			}
		);
		await t.test(
			'bounds, category and malformed rich JSON reject without modifying article',
			async () => {
				const id = await seed('user');
				const before = await articles.findOne({ _id: new ObjectId(id) });
				for (const bad of [
					{ title: '' },
					{ title: 'x'.repeat(201) },
					{ excerpt: '' },
					{ excerpt: 'x'.repeat(501) },
					{ categoryId: 'invalid' },
					{ categoryId: new ObjectId().toHexString() },
					{ contentRich: '{' },
					{ contentRich: { version: 1, doc: { type: 'doc', content: [{ type: 'script' }] } } },
					{ contentRich: '', content: 'x'.repeat(50_001) },
					{ contentRich: '', content: '' }
				]) {
					assert.equal(
						(
							await boundary.handleOwnArticleMutation(
								request(bad),
								{ _id: authorId },
								id,
								'edit',
								deps
							)
						).status,
						400
					);
					assert.deepEqual(await articles.findOne({ _id: new ObjectId(id) }), before);
				}
				await assert.rejects(() =>
					management.updateOwnArticle(
						articles,
						id,
						authorId,
						'user',
						{ ...fields, contentRich: { version: 99 } },
						now
					)
				);
				assert.deepEqual(await articles.findOne({ _id: new ObjectId(id) }), before);
			}
		);
		await t.test('both operations share 30/10min failclosed bucket', async () => {
			const id = await seed('user');
			let count = 0;
			const options: unknown[] = [];
			const limited = {
				...deps,
				checkRateLimit: async (option: unknown) => {
					options.push(option);
					count++;
					return { ok: count <= 30, remaining: 30 - count, retryAfter: 600 };
				}
			};
			for (let n = 0; n < 30; n++)
				assert.equal(
					(
						await boundary.handleOwnArticleMutation(
							request(),
							{ _id: authorId },
							id,
							'edit',
							limited
						)
					).status,
					200
				);
			assert.equal(
				(
					await boundary.handleOwnArticleMutation(
						request(),
						{ _id: authorId },
						id,
						'delete',
						limited
					)
				).status,
				429
			);
			assert.ok(await articles.findOne({ _id: new ObjectId(id) }));
			assert.ok(
				options.every(
					(option) =>
						JSON.stringify(option) ===
						JSON.stringify({
							key: `article-modify:${authorId}`,
							limit: 30,
							windowMs: 600_000,
							onError: 'closed'
						})
				)
			);
			assert.equal(
				(
					await boundary.handleOwnArticleMutation(request(), { _id: authorId }, id, 'edit', {
						...deps,
						checkRateLimit: async () => {
							throw new Error('down');
						}
					})
				).status,
				429
			);
			const closed = await boundary.handleOwnArticleMutation(
				request(),
				{ _id: authorId },
				id,
				'edit',
				{ ...deps, checkRateLimit: async () => ({ ok: false, remaining: 0, retryAfter: 600 }) }
			);
			assert.equal(
				closed.draft?.title,
				'  Nuevo  ',
				'429 must retain submitted draft for non-JS form rerender'
			);
		});
		await t.test(
			'atomic writes recheck ownership and retain concurrent engagement increments',
			async () => {
				const id = await seed('admin');
				await articles.updateOne(
					{ _id: new ObjectId(id) },
					{ $inc: { views: 1 }, $addToSet: { likes: 'concurrent' } }
				);
				assert.equal(
					await management.updateOwnArticle(articles, id, authorId, 'admin', fields, now),
					true
				);
				assert.equal((await articles.findOne({ _id: new ObjectId(id) }))?.views, 13);
				assert.deepEqual((await articles.findOne({ _id: new ObjectId(id) }))?.likes, [
					otherId,
					'concurrent'
				]);
				await articles.updateOne({ _id: new ObjectId(id) }, { $set: { authorId: otherId } });
				assert.equal(
					await management.updateOwnArticle(articles, id, authorId, 'superadmin', fields, now),
					false
				);
				assert.equal(await management.deleteOwnArticle(articles, id, authorId), null);
				const raced = await seed('user');
				const changing = {
					...deps,
					checkRateLimit: async () => {
						await articles.updateOne({ _id: new ObjectId(raced) }, { $set: { authorId: otherId } });
						return { ok: true, remaining: 29, retryAfter: 0 };
					}
				};
				cleaned.length = 0;
				assert.equal(
					(
						await boundary.handleOwnArticleMutation(
							request(),
							{ _id: authorId },
							raced,
							'delete',
							changing
						)
					).status,
					404
				);
				assert.deepEqual(cleaned, []);
				const racedEdit = await seed('user');
				const changingEdit = {
					...deps,
					checkRateLimit: async () => {
						await articles.updateOne(
							{ _id: new ObjectId(racedEdit) },
							{ $set: { authorId: otherId } }
						);
						return { ok: true, remaining: 29, retryAfter: 0 };
					}
				};
				assert.equal(
					(
						await boundary.handleOwnArticleMutation(
							request(),
							{ _id: authorId },
							racedEdit,
							'edit',
							changingEdit
						)
					).status,
					404
				);
				assert.equal((await articles.findOne({ _id: new ObjectId(racedEdit) }))?.title, 'Original');
			}
		);
		await t.test(
			'cleanup failures report article deleted and log authorized keys only',
			async () => {
				const id = await seed('user');
				const failed: string[] = [];
				const result = await boundary.handleOwnArticleMutation(
					request({ keys: ['evil-key'] }),
					{ _id: authorId },
					id,
					'delete',
					{
						...deps,
						deleteFile: async () => {
							throw new Error('S3 down');
						},
						logCleanupFailure: (key: string) => failed.push(key)
					}
				);
				assert.equal(result.status, 200);
				assert.match(result.message, /eliminado/i);
				assert.match(result.message, /archivos/i);
				assert.deepEqual(failed.sort(), ['owned-image', 'owned-pdf']);
				assert.equal(await articles.findOne({ _id: new ObjectId(id) }), null);
			}
		);
		await t.test('operational failures return generic500 and preserve edit draft', async () => {
			const id = await seed('user');
			const before = await articles.findOne({ _id: new ObjectId(id) });
			const unavailable = {
				...deps,
				articles: {
					findOne: articles.findOne.bind(articles),
					updateOne: async () => {
						throw new Error('private Mongo host secret');
					},
					findOneAndDelete: async () => {
						throw new Error('private Mongo host secret');
					}
				},
				logMutationFailure: () => {}
			};
			const edit = await boundary.handleOwnArticleMutation(
				request(),
				{ _id: authorId },
				id,
				'edit',
				unavailable
			);
			assert.equal(edit.status, 500);
			assert.doesNotMatch(edit.message, /private|Mongo|secret/);
			assert.equal(edit.draft?.title, '  Nuevo  ');
			const remove = await boundary.handleOwnArticleMutation(
				request(),
				{ _id: authorId },
				id,
				'delete',
				unavailable
			);
			assert.equal(remove.status, 500);
			assert.doesNotMatch(remove.message, /private|Mongo|secret|eliminado/);
			assert.deepEqual(await articles.findOne({ _id: new ObjectId(id) }), before);
			const accountUnavailable = {
				...deps,
				users: {
					findOne: async () => {
						throw new Error('private Mongo account secret');
					}
				},
				logMutationFailure: () => {}
			};
			const authentication = await boundary.handleOwnArticleMutation(
				request(),
				{ _id: authorId },
				id,
				'edit',
				accountUnavailable
			);
			assert.equal(authentication.status, 500);
			assert.doesNotMatch(authentication.message, /Mongo|private|secret/);
		});
		await t.test(
			'non-JS title edits retain stored heading/link; changed plain rich edits reject without mutation',
			async () => {
				const id = await seed('user');
				const rich: NonNullable<ArticleDoc['contentRich']> = {
					version: 1,
					doc: {
						type: 'doc',
						content: [
							{
								type: 'heading',
								attrs: { level: 2 },
								content: [{ type: 'text', text: 'Encabezado' }]
							},
							{
								type: 'paragraph',
								content: [
									{
										type: 'text',
										text: 'Enlace',
										marks: [{ type: 'link', attrs: { href: '/feed' } }]
									}
								]
							}
						]
					}
				};
				const originalPlain = 'Encabezado\nEnlace';
				await articles.updateOne(
					{ _id: new ObjectId(id) },
					{ $set: { content: originalPlain, contentRich: rich } }
				);
				const plainRequest = (content: string, includeEmptyRich: boolean) => {
					const form = new FormData();
					for (const [key, value] of Object.entries({
						title: 'Solo cambió el título',
						excerpt: 'Resumen',
						categoryId,
						content
					}))
						form.set(key, value);
					if (includeEmptyRich) form.set('contentRich', '');
					return new Request('https://paper.test/redaccion', { method: 'POST', body: form });
				};
				for (const includeEmptyRich of [false, true]) {
					const result = await boundary.handleOwnArticleMutation(
						plainRequest(originalPlain, includeEmptyRich),
						{ _id: authorId },
						id,
						'edit',
						deps
					);
					assert.equal(result.status, 200);
					const saved = await articles.findOne({ _id: new ObjectId(id) });
					assert.equal(saved?.title, 'Solo cambió el título');
					assert.deepEqual(
						saved?.contentRich,
						rich,
						'title-only save must not silently discard rich formatting'
					);
					assert.equal(saved?.content, originalPlain);
				}
				const before = await articles.findOne({ _id: new ObjectId(id) });
				const changed = await boundary.handleOwnArticleMutation(
					plainRequest('Cambió el texto sin editor', true),
					{ _id: authorId },
					id,
					'edit',
					deps
				);
				assert.equal(changed.status, 400);
				assert.match(changed.message, /editor/i);
				assert.equal(changed.draft?.content, 'Cambió el texto sin editor');
				assert.deepEqual(await articles.findOne({ _id: new ObjectId(id) }), before);
				assert.equal(
					(
						await boundary.handleOwnArticleMutation(
							request({ content: originalPlain, contentRich: '{' }),
							{ _id: authorId },
							id,
							'edit',
							deps
						)
					).status,
					400
				);
				assert.deepEqual(await articles.findOne({ _id: new ObjectId(id) }), before);
				const legacyId = await seed('user');
				assert.equal(
					(
						await boundary.handleOwnArticleMutation(
							plainRequest('Texto legacy nuevo', false),
							{ _id: authorId },
							legacyId,
							'edit',
							deps
						)
					).status,
					200
				);
				assert.equal(
					(await articles.findOne({ _id: new ObjectId(legacyId) }))?.content,
					'Texto legacy nuevo'
				);
			}
		);
		await t.test(
			'stale moderator snapshots cannot approve unseen edited pending text',
			async () => {
				assert.equal(typeof moderation.reviewArticleRevision, 'function');
				const id = await seed('user', 'pending');
				assert.equal(
					await moderation.reviewArticleRevision(articles, id, 'published', 0, undefined, now),
					true
				);
				await articles.updateOne(
					{ _id: new ObjectId(id) },
					{ $set: { status: 'pending' }, $unset: { revision: '' } }
				);
				assert.equal(
					await management.updateOwnArticle(articles, id, authorId, 'user', fields, now),
					true
				);
				assert.equal(
					await moderation.reviewArticleRevision(articles, id, 'published', 0, undefined, now),
					false
				);
				assert.equal(
					await moderation.reviewArticleRevision(articles, id, 'rejected', 0, 'old rejection', now),
					false
				);
				assert.equal((await articles.findOne({ _id: new ObjectId(id) }))?.status, 'pending');
				assert.equal(
					await moderation.reviewArticleRevision(articles, id, 'published', 1, undefined, now),
					true
				);
				assert.equal(
					await moderation.reviewArticleRevision(articles, id, 'rejected', 1, 'cannot repeat', now),
					false
				);
			}
		);
	} finally {
		await client.close();
		await mongo.stop();
	}
});
