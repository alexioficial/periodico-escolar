import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId, type Db } from 'mongodb';
import { InstitutionalEmailRequiredError } from '../src/lib/server/authEmailPolicy.ts';
import { findOrCreateGoogleUserInDb } from '../src/lib/server/googleUserMaterialization.ts';

type User = {
	_id: ObjectId;
	email: string;
	username?: string;
	provider: 'credentials' | 'google';
	googleId?: string;
	createdAt: Date;
	name?: string;
	picture?: string;
	emailVerified?: boolean;
	role: 'user' | 'admin' | 'superadmin';
};

function fakeDb(initialUsers: User[] = []) {
	const users = [...initialUsers];
	const updates: Array<{ filter: Record<string, unknown>; update: Record<string, unknown> }> = [];
	const collection = {
		async findOne(filter: {
			_id?: ObjectId;
			email?: string;
			username?: string;
			googleId?: string;
		}) {
			return (
				users.find(
					(user) =>
						(filter._id !== undefined && user._id.equals(filter._id)) ||
						(filter.email !== undefined && user.email === filter.email) ||
						(filter.username !== undefined && user.username === filter.username) ||
						(filter.googleId !== undefined && user.googleId === filter.googleId)
				) ?? null
			);
		},
		async updateOne(
			filter: { _id?: ObjectId; googleId?: string },
			update: { $set?: Partial<User>; $setOnInsert?: Omit<User, '_id'> },
			options?: { upsert?: boolean }
		) {
			updates.push({ filter, update });
			const existing = users.find(
				(user) =>
					(filter._id !== undefined && user._id.equals(filter._id)) ||
					(filter.googleId !== undefined && user.googleId === filter.googleId)
			);
			if (existing && update.$set) Object.assign(existing, update.$set);
			if (!existing && options?.upsert && update.$setOnInsert) {
				users.push({ ...update.$setOnInsert, _id: new ObjectId() } as User);
			}
			return { acknowledged: true };
		}
	};
	return {
		db: { collection: () => collection } as unknown as Db,
		users,
		updates
	};
}

const profile = {
	sub: 'google-123',
	email: 'Alumno@Salesianos.Edu.Do',
	name: 'Alumno SDS',
	picture: 'https://example.com/avatar.png',
	email_verified: true
};

test('una cuenta externa existente entra por googleId sin validar el dominio', async () => {
	const existing: User = {
		_id: new ObjectId(),
		email: 'persona@gmail.com',
		provider: 'google',
		googleId: profile.sub,
		createdAt: new Date(),
		role: 'user'
	};
	const fixture = fakeDb([existing]);

	const result = await findOrCreateGoogleUserInDb(fixture.db, {
		...profile,
		email: existing.email
	});

	assert.equal(result?._id.toHexString(), existing._id.toHexString());
	assert.equal(fixture.users.length, 1);
});

test('una cuenta externa existente por correo se vincula con Google', async () => {
	const existing: User = {
		_id: new ObjectId(),
		email: 'persona@gmail.com',
		provider: 'credentials',
		createdAt: new Date(),
		role: 'user'
	};
	const fixture = fakeDb([existing]);

	const result = await findOrCreateGoogleUserInDb(fixture.db, {
		...profile,
		email: ' PERSONA@GMAIL.COM '
	});

	assert.equal(result?.googleId, profile.sub);
	assert.equal(result?.emailVerified, true);
	assert.equal(fixture.users.length, 1);
});

test('una cuenta institucional nueva se crea mediante Google', async () => {
	const fixture = fakeDb();

	const result = await findOrCreateGoogleUserInDb(fixture.db, profile);

	assert.equal(result?.email, 'alumno@salesianos.edu.do');
	assert.equal(result?.googleId, profile.sub);
	assert.equal(result?.provider, 'google');
	assert.equal(fixture.users.length, 1);
});

test('una cuenta externa nueva se rechaza mediante Google', async () => {
	const fixture = fakeDb();

	await assert.rejects(
		findOrCreateGoogleUserInDb(fixture.db, { ...profile, email: 'nuevo@gmail.com' }),
		InstitutionalEmailRequiredError
	);
	assert.equal(fixture.users.length, 0);
});

test('Google debe confirmar que el correo está verificado', async () => {
	const fixture = fakeDb();

	await assert.rejects(
		findOrCreateGoogleUserInDb(fixture.db, { ...profile, email_verified: false }),
		/Google no confirmó que el correo esté verificado/
	);
});
