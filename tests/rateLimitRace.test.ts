import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoServerError } from 'mongodb';
import { checkRateLimitInCollection } from '../src/lib/server/rateLimitCore.ts';

test('solicitudes simultáneas no reinician el bucket nuevo ni superan el límite', async () => {
	const now = new Date('2026-09-13T00:00:00Z');
	const state: { bucket: { count: number; resetAt: Date } | null } = { bucket: null };
	let arrived = 0;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const collection = {
		async findOneAndUpdate() {
			if (state.bucket && state.bucket.resetAt > now) {
				state.bucket.count++;
				return { ...state.bucket };
			}
			arrived++;
			if (arrived === 20) release();
			await gate;
			return null;
		},
		async updateOne(
			filter: { resetAt: { $lte: Date } },
			update: { $set: { count: number; resetAt: Date } }
		) {
			if (state.bucket && state.bucket.resetAt > filter.resetAt.$lte) {
				throw new MongoServerError({ code: 11000, errmsg: 'duplicate key' });
			}
			state.bucket = { ...update.$set };
		}
	};
	const options = { key: 'view:ip', limit: 5, windowMs: 300_000 };
	const results = await Promise.all(
		Array.from({ length: 20 }, () =>
			checkRateLimitInCollection(
				collection as unknown as Parameters<typeof checkRateLimitInCollection>[0],
				options,
				now
			)
		)
	);
	assert.equal(results.filter((result) => result.ok).length, 5);
	assert.equal(state.bucket?.count, 20);
});
