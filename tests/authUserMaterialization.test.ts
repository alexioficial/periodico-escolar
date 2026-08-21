import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId, type Db } from 'mongodb';
import { findOrCreateUserByEmailInDb } from '../src/lib/server/authUserMaterialization.ts';

for (const initialEmailVerified of [false, undefined] as const) {
	test(`el bypass QA persiste la verificación de una cuenta existente (${String(initialEmailVerified)})`, async () => {
		const user = {
			_id: new ObjectId(),
			email: 'qa-existing@example.com',
			username: 'qa-existing',
			provider: 'credentials' as const,
			createdAt: new Date(),
			emailVerified: initialEmailVerified as boolean | undefined,
			role: 'user' as const
		};
		const updates: unknown[] = [];
		const collection = {
			async findOne(filter: { email?: string }) {
				return filter.email === user.email ? user : null;
			},
			async updateOne(filter: unknown, update: { $set: { emailVerified: boolean } }) {
				updates.push({ filter, update });
				user.emailVerified = update.$set.emailVerified;
				return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
			}
		};
		const db = {
			collection(name: string) {
				assert.equal(name, 'users');
				return collection;
			}
		} as unknown as Db;

		const result = await findOrCreateUserByEmailInDb(db, 'QA-EXISTING@EXAMPLE.COM', 'qa-bypass');

		assert.equal(result?.emailVerified, true);
		assert.equal(user.emailVerified, true);
		assert.deepEqual(updates, [
			{
				filter: { _id: user._id },
				update: { $set: { emailVerified: true } }
			}
		]);
	});
}
