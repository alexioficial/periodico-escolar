import assert from 'node:assert/strict';
import test from 'node:test';
import { incrementPublishedArticleView } from '../src/lib/server/articleViews.ts';

test('incrementa de forma atómica solo un artículo publicado', async () => {
	const captured: { call?: unknown[] } = {};
	const collection = {
		async updateOne(filter: unknown, update: unknown) {
			captured.call = [filter, update];
			return { matchedCount: 1 };
		}
	};
	assert.equal(await incrementPublishedArticleView(collection, '507f1f77bcf86cd799439011'), true);
	assert.ok(captured.call);
	const [filter, update] = captured.call;
	assert.equal(
		(filter as { _id: { toHexString(): string } })._id.toHexString(),
		'507f1f77bcf86cd799439011'
	);
	assert.deepEqual(
		{ ...(filter as object), _id: undefined },
		{ _id: undefined, status: 'published' }
	);
	assert.deepEqual(update, { $inc: { views: 1 } });
});

test('no escribe con ID inválido ni aumenta un artículo no publicado', async () => {
	let calls = 0;
	const collection = {
		async updateOne() {
			calls++;
			return { matchedCount: 0 };
		}
	};
	assert.equal(await incrementPublishedArticleView(collection, 'bad-id'), false);
	assert.equal(calls, 0);
	assert.equal(await incrementPublishedArticleView(collection, '507f1f77bcf86cd799439011'), false);
	assert.equal(calls, 1);
});
