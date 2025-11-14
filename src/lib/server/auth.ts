import type { Db, ObjectId } from 'mongodb';
import { getDb } from './db';
import crypto from 'crypto';

const USERS_COLLECTION = 'users';

interface UserDoc {
	_id: ObjectId;
	email: string;
	passwordHash?: string;
	salt?: string;
	provider: 'credentials' | 'google';
	googleId?: string;
	createdAt: Date;
	name?: string;
	picture?: string;
	emailVerified?: boolean;
}

interface GoogleUserProfile {
	sub: string;
	email: string;
	name?: string;
	picture?: string;
	email_verified?: boolean;
}

function hashPassword(password: string, salt?: string) {
	const usedSalt = salt ?? crypto.randomBytes(16).toString('hex');
	const hash = crypto.pbkdf2Sync(password, usedSalt, 100_000, 64, 'sha512').toString('hex');
	return { hash, salt: usedSalt };
}

export async function createUser(email: string, password: string) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const existing = await users.findOne({ email });
	if (existing) {
		throw new Error('El correo ya está registrado');
	}

	const { hash, salt } = hashPassword(password);

	const result = await users.insertOne({
		email,
		passwordHash: hash,
		salt,
		createdAt: new Date(),
		provider: 'credentials'
	} as UserDoc);

	return result.insertedId;
}

export async function validateUser(email: string, password: string) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const user = await users.findOne({ email, provider: 'credentials' });
	if (!user || !user.passwordHash || !user.salt) return null;

	const { hash } = hashPassword(password, user.salt);
	if (hash !== user.passwordHash) return null;

	return user;
}

export async function findOrCreateUserFromGoogle(profile: GoogleUserProfile) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	let user = await users.findOne({ provider: 'google', googleId: profile.sub });

	if (!user) {
		user = await users.findOne({ email: profile.email });
	}

	if (!user) {
		const result = await users.insertOne({
			email: profile.email,
			provider: 'google',
			googleId: profile.sub,
			name: profile.name,
			picture: profile.picture,
			emailVerified: profile.email_verified,
			createdAt: new Date()
		} as UserDoc);

		user = await users.findOne({ _id: result.insertedId });
	}

	return user;
}
