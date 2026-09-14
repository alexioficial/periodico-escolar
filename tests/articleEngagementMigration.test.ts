import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateArticleEngagement } from '../src/lib/server/articleEngagementMigration.ts';

test('borra todos los likes históricos e inicializa vistas faltantes sin tocar otros campos', async () => {
	const calls: unknown[][] = [];
	const collection = {
		async updateMany(filter: unknown, update: unknown) {
			calls.push([filter, update]);
		}
	};
	await migrateArticleEngagement(collection);
	assert.deepEqual(calls, [
		[{ likes: { $exists: true } }, { $unset: { likes: '' } }],
		[{ views: { $exists: false } }, { $set: { views: 0 } }]
	]);
});
