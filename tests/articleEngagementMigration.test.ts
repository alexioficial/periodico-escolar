import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateArticleEngagement } from '../src/lib/server/articleEngagementMigration.ts';

test('inicializa únicamente vistas faltantes y nunca elimina likes', async () => {
	const calls: unknown[][] = [];
	const collection = {
		async updateMany(filter: unknown, update: unknown) {
			calls.push([filter, update]);
		}
	};
	await migrateArticleEngagement(collection);
	assert.deepEqual(calls, [[{ views: { $exists: false } }, { $set: { views: 0 } }]]);
});
