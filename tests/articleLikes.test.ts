import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getArticleLikeSummary,
	getRequestedLikeState,
	setPublishedArticleLike
} from '../src/lib/server/articleLikes.ts';

test('acepta únicamente un estado de like booleano en el body', () => {
	assert.equal(getRequestedLikeState({ liked: true }), true);
	assert.equal(getRequestedLikeState({ liked: false }), false);
	for (const body of [null, [], {}, { liked: 'true' }, true]) {
		assert.equal(getRequestedLikeState(body), null);
	}
});

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

test('fija un like de forma idempotente y devuelve el estado persistido', async () => {
	const calls: unknown[][] = [];
	const collection = {
		async findOneAndUpdate(filter: unknown, update: unknown, options: unknown) {
			calls.push([filter, update, options]);
			return { likes: ['user-1'] };
		}
	};

	assert.deepEqual(
		await setPublishedArticleLike(collection, '507f1f77bcf86cd799439011', 'user-1', true),
		{ isLiked: true, likesCount: 1 }
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
	assert.deepEqual(calls[0][2], { returnDocument: 'after', projection: { likes: 1 } });
});

test('fija el estado sin depender de una lectura previa', async () => {
	let call: unknown[] | undefined;
	const collection = {
		async findOneAndUpdate(filter: unknown, update: unknown, options: unknown) {
			call = [filter, update, options];
			return { likes: ['user-2'] };
		}
	};

	assert.deepEqual(
		await setPublishedArticleLike(collection, '507f1f77bcf86cd799439011', 'user-1', false),
		{ isLiked: false, likesCount: 1 }
	);
	assert.deepEqual(call?.[1], { $pull: { likes: 'user-1' } });
});

test('no cambia drafts, IDs inválidos ni usuarios vacíos', async () => {
	let updates = 0;
	const collection = {
		async findOneAndUpdate() {
			updates++;
			return null;
		}
	};

	assert.equal(await setPublishedArticleLike(collection, 'bad-id', 'user-1', true), null);
	assert.equal(
		await setPublishedArticleLike(collection, '507f1f77bcf86cd799439011', '', true),
		null
	);
	assert.equal(
		await setPublishedArticleLike(collection, '507f1f77bcf86cd799439011', 'user-1', true),
		null
	);
	assert.equal(updates, 1);
});
