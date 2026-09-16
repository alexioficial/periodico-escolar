import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId, type Db } from 'mongodb';
import { InstitutionalEmailRequiredError } from '../src/lib/server/authEmailPolicy.ts';
import { findOrCreateUserByEmailInDb } from '../src/lib/server/authUserMaterialization.ts';

type User = {
	_id: ObjectId;
	email: string;
	username?: string;
	provider: 'credentials' | 'google';
	createdAt: Date;
	emailVerified?: boolean;
	role: 'user' | 'admin' | 'superadmin';
};

function fakeDb(initialUsers: User[] = []) {
	const users = [...initialUsers];
	const inserts: User[] = [];
	const collection = {
		async findOne(filter: { _id?: ObjectId; email?: string; username?: string }) {
			return (
				users.find(
					(user) =>
						(filter._id !== undefined && user._id.equals(filter._id)) ||
						(filter.email !== undefined && user.email === filter.email) ||
						(filter.username !== undefined && user.username === filter.username)
				) ?? null
			);
		},
		async updateOne(filter: { _id: ObjectId }, update: { $set: Partial<User> }) {
			const user = users.find((candidate) => candidate._id.equals(filter._id));
			if (user) Object.assign(user, update.$set);
			return { acknowledged: true, matchedCount: user ? 1 : 0, modifiedCount: user ? 1 : 0 };
		},
		async insertOne(input: Omit<User, '_id'>) {
			const inserted = { ...input, _id: new ObjectId() } as User;
			users.push(inserted);
			inserts.push(inserted);
			return { acknowledged: true, insertedId: inserted._id };
		}
	};
	return {
		db: { collection: () => collection } as unknown as Db,
		inserts
	};
}

test('una cuenta externa existente inicia sesión y queda verificada', async () => {
	const existing: User = {
		_id: new ObjectId(),
		email: 'persona@gmail.com',
		username: 'persona',
		provider: 'credentials',
		createdAt: new Date(),
		emailVerified: false,
		role: 'user'
	};
	const fixture = fakeDb([existing]);

	const result = await findOrCreateUserByEmailInDb(fixture.db, ' PERSONA@GMAIL.COM ');

	assert.equal(result?._id.toHexString(), existing._id.toHexString());
	assert.equal(result?.emailVerified, true);
	assert.equal(fixture.inserts.length, 0);
});

test('una cuenta institucional nueva se crea con correo normalizado y verificado', async () => {
	const fixture = fakeDb();

	const result = await findOrCreateUserByEmailInDb(
		fixture.db,
		' Alumno+Periodico@SALESIANOS.EDU.DO '
	);

	assert.equal(result?.email, 'alumno+periodico@salesianos.edu.do');
	assert.equal(result?.emailVerified, true);
	assert.equal(fixture.inserts.length, 1);
});

test('una cuenta externa nueva se rechaza antes de insertar', async () => {
	const fixture = fakeDb();

	await assert.rejects(
		findOrCreateUserByEmailInDb(fixture.db, 'nuevo@gmail.com'),
		InstitutionalEmailRequiredError
	);
	assert.equal(fixture.inserts.length, 0);
});
