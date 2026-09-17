import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('actual moderation endpoint retains409 for stale snapshots and validates revisions/roles', async () => {
	// Compile the real route and real SvelteKit error/json implementation. Only
	// the Mongo persistence operation is injected; framework HttpError is real.
	const result = await build({
		stdin: {
			contents: `export {POST} from './src/routes/api/articles/[id]/moderate/+server.ts';
export {setTestUpdate} from '$lib/server/articles';`,
			resolveDir: process.cwd()
		},
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'node',
		plugins: [
			{
				name: 'moderation-persistence',
				setup(builder) {
					builder.onResolve({ filter: /^\$lib\/server\/articles$/ }, () => ({
						path: 'articles',
						namespace: 'test'
					}));
					builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
						contents: `let update=async()=>true;
export function setTestUpdate(fn){update=fn;}
export async function updateArticleStatus(...args){return update(...args);}`
					}));
				}
			}
		]
	});
	const runtime = await import(
		`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
	);
	const id = '507f1f77bcf86cd799439011';
	const invoke = (body: unknown, role: string | null = 'admin') =>
		runtime.POST({
			locals: { user: role ? { _id: 'staff', role } : null },
			params: { id },
			request: new Request('https://paper.test/api/articles/' + id + '/moderate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
		});
	const status = (want: number) => (error: unknown) => {
		assert.equal((error as { status: number }).status, want);
		return true;
	};
	runtime.setTestUpdate(async () => false);
	await assert.rejects(() => invoke({ decision: 'approve', revision: 1 }), status(409));
	await assert.rejects(
		() => invoke({ decision: 'reject', revision: 1, reason: 'Anterior' }),
		status(409)
	);
	for (const revision of [undefined, null, -1, 0.5, '1'])
		await assert.rejects(() => invoke({ decision: 'approve', revision }), status(400));
	for (const role of [null, 'user'])
		await assert.rejects(() => invoke({ decision: 'approve', revision: 0 }, role), status(401));
	const calls: unknown[][] = [];
	runtime.setTestUpdate(async (...args: unknown[]) => {
		calls.push(args);
		return true;
	});
	assert.equal((await invoke({ decision: 'approve', revision: 0 }, 'superadmin')).status, 200);
	assert.deepEqual(
		await (await invoke({ decision: 'reject', revision: 2, reason: ' Motivo ' })).json(),
		{ ok: true }
	);
	assert.deepEqual(calls, [
		[id, 'published', undefined, 0],
		[id, 'rejected', 'Motivo', 2]
	]);
});
