import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('actual edit action retains safe rich draft HTML on non-JS400/429/500 without rich JSON DTO', async () => {
	const require = createRequire(import.meta.url);
	const result = await build({
		stdin: {
			contents: `export {actions} from './src/routes/redaccion/[id]/editar/+page.server.ts';
export {setTestDependencies} from '$lib/server/ownArticleDependencies';`,
			resolveDir: process.cwd()
		},
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'node',
		plugins: [
			{
				name: 'edit-action-io',
				setup(builder) {
					builder.onResolve({ filter: /^mongodb$/ }, () => ({
						path: pathToFileURL(require.resolve('mongodb')).href,
						external: true
					}));
					builder.onResolve({ filter: /^\$lib\/server\/ownArticleDependencies$/ }, () => ({
						path: 'dependencies',
						namespace: 'test'
					}));
					builder.onResolve({ filter: /^\$lib\/server\/categories$/ }, () => ({
						path: 'categories',
						namespace: 'test'
					}));
					builder.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
						contents:
							args.path === 'categories'
								? 'export async function getCategories(){return []}'
								: `let dependencies;
export function setTestDependencies(value){dependencies=value}
export async function ownArticleDependencies(){return dependencies}`
					}));
					builder.onResolve({ filter: /^\$lib\// }, (args) => ({
						path: resolve('src/lib', args.path.slice(5)) + '.ts'
					}));
				}
			}
		]
	});
	const runtime = await import(
		`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
	);
	const id = '507f1f77bcf86cd799439011';
	const authorId = '507f1f77bcf86cd799439012';
	const categoryId = '507f1f77bcf86cd799439013';
	const plain = 'Sección\nFormato Enlace';
	const existing = {
		content: plain,
		contentRich: {
			version: 1,
			doc: {
				type: 'doc',
				content: [
					{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sección' }] },
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'Formato', marks: [{ type: 'bold' }] },
							{ type: 'text', text: ' ' },
							{ type: 'text', text: 'Enlace', marks: [{ type: 'link', attrs: { href: '/feed' } }] }
						]
					}
				]
			}
		},
		authorId,
		title: 'Original',
		excerpt: 'Resumen',
		categoryId,
		status: 'published'
	};
	let writes = 0;
	let rateOpen = true;
	runtime.setTestDependencies({
		users: {
			findOne: async () => ({ provider: 'credentials', emailVerified: true, role: 'user' })
		},
		articles: {
			findOne: async () => existing,
			updateOne: async () => {
				writes++;
				throw new Error('private DB detail');
			}
		},
		categories: { findOne: async () => ({}) },
		checkRateLimit: async () => ({ ok: rateOpen, remaining: 0, retryAfter: 600 }),
		deleteFile: async () => {},
		logCleanupFailure: () => {},
		logMutationFailure: () => {}
	});
	const invoke = (title: string, content = plain) => {
		const form = new FormData();
		for (const [key, value] of Object.entries({
			title,
			content,
			excerpt: 'Resumen',
			categoryId,
			contentRich: ''
		}))
			form.set(key, value);
		return runtime.actions.edit({
			locals: { user: { _id: authorId } },
			params: { id },
			request: new Request('https://paper.test/redaccion/' + id + '/editar', {
				method: 'POST',
				body: form
			})
		});
	};
	for (const [title, open, status] of [
		['', true, 400],
		['Otro título', false, 429],
		['Otro título', true, 500]
	] as const) {
		rateOpen = open;
		const failure = await invoke(title);
		assert.equal(failure.status, status);
		assert.match(failure.data.draft.contentHtml, /<h2>Sección<\/h2>/);
		assert.match(failure.data.draft.contentHtml, /<strong>Formato<\/strong>/);
		assert.match(failure.data.draft.contentHtml, /<a href="\/feed"/);
		assert.equal('contentRich' in failure.data.draft, false);
	}
	assert.equal(writes, 1);
	rateOpen = true;
	const changed = await invoke('Otro título', 'Mi texto nuevo');
	assert.equal(changed.status, 400);
	assert.equal(changed.data.draft.content, 'Mi texto nuevo');
	assert.equal(changed.data.draft.contentHtml, 'Mi texto nuevo');
	assert.equal(writes, 1);
});
