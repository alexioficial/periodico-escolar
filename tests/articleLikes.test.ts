import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getArticleLikeSummary,
	togglePublishedArticleLike
} from '../src/lib/server/articleLikes.ts';

test('el resumen público expone conteo y estado, nunca IDs', () => {
	assert.deepEqual(getArticleLikeSummary(['user-1', 'user-2'], 'user-2'), {
		isLiked: true,
		likesCount: 2
	});
	assert.deepEqual(getArticleLikeSummary(['user-1'], undefined), {
		isLiked: false,
		likesCount: 1
	});
});

test('agrega un like una sola vez a un artículo publicado', async () => {
	const calls: unknown[][] = [];
	const collection = {
		async findOne() {
			return { likes: [] };
		},
		async updateOne(filter: unknown, update: unknown) {
			calls.push([filter, update]);
			return { matchedCount: 1 };
		}
	};

	assert.equal(
		await togglePublishedArticleLike(collection, '507f1f77bcf86cd799439011', 'user-1'),
		true
	);
	assert.equal(
		(calls[0][0] as { _id: { toHexString(): string } })._id.toHexString(),
		'507f1f77bcf86cd799439011'
	);
	assert.deepEqual(
		{ ...(calls[0][0] as object), _id: undefined },
		{ _id: undefined, status: 'published' }
	);
	assert.deepEqual(calls[0][1], { $addToSet: { likes: 'user-1' } });
});

test('quita un like existente de un artículo publicado', async () => {
	let update: unknown;
	const collection = {
		async findOne() {
			return { likes: ['user-1'] };
		},
		async updateOne(_filter: unknown, nextUpdate: unknown) {
			update = nextUpdate;
			return { matchedCount: 1 };
		}
	};

	assert.equal(
		await togglePublishedArticleLike(collection, '507f1f77bcf86cd799439011', 'user-1'),
		false
	);
	assert.deepEqual(update, { $pull: { likes: 'user-1' } });
});

test('no cambia drafts, IDs inválidos ni usuarios vacíos', async () => {
	let updates = 0;
	const collection = {
		async findOne() {
			return null;
		},
		async updateOne() {
			updates++;
			return { matchedCount: 0 };
		}
	};

	assert.equal(await togglePublishedArticleLike(collection, 'bad-id', 'user-1'), null);
	assert.equal(await togglePublishedArticleLike(collection, '507f1f77bcf86cd799439011', ''), null);
	assert.equal(
		await togglePublishedArticleLike(collection, '507f1f77bcf86cd799439011', 'user-1'),
		null
	);
	assert.equal(updates, 0);
});
