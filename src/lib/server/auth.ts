import type { Db, ObjectId } from 'mongodb';
import { getDb } from './db';
import argon2 from 'argon2';

const USERS_COLLECTION = 'users';

interface UserDoc {
	_id: ObjectId;
	email: string;
	username?: string;
	passwordHash?: string | null;
	provider: 'credentials' | 'google';
	googleId?: string;
	createdAt: Date;
	name?: string;
	picture?: string;
	emailVerified?: boolean;
	role: 'user' | 'admin' | 'superadmin';
}

interface GoogleUserProfile {
	sub: string;
	email: string;
	name?: string;
	picture?: string;
	email_verified?: boolean;
}

export class EmailAlreadyRegisteredError extends Error {
	constructor() {
		super('El correo ya está registrado');
		this.name = 'EmailAlreadyRegisteredError';
	}
}

export class UsernameTakenError extends Error {
	constructor() {
		super('El nombre de usuario ya está en uso');
		this.name = 'UsernameTakenError';
	}
}

export class EmailAccountConflictError extends Error {
	constructor() {
		super(
			'Ya existe una cuenta con este correo registrada con contraseña. Inicia sesión con tu contraseña.'
		);
		this.name = 'EmailAccountConflictError';
	}
}

export async function hashPassword(password: string) {
	return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
	try {
		return await argon2.verify(hash, password);
	} catch {
		return false;
	}
}

export async function createUser(email: string, username: string, password: string) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const [existingEmail, existingUsername] = await Promise.all([
		users.findOne({ email }),
		users.findOne({ username })
	]);
	if (existingEmail) throw new EmailAlreadyRegisteredError();
	if (existingUsername) throw new UsernameTakenError();

	const passwordHash = await hashPassword(password);

	const result = await users.insertOne({
		email,
		username,
		passwordHash,
		createdAt: new Date(),
		provider: 'credentials',
		emailVerified: false,
		role: 'user'
	} as UserDoc);

	return result.insertedId;
}

export async function validateUser(email: string, password: string) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const user = await users.findOne({ email, provider: 'credentials' });
	if (!user || !user.passwordHash) return null;

	const ok = await verifyPassword(user.passwordHash, password);
	if (!ok) return null;

	return user;
}

export async function setUserPassword(userId: ObjectId, newPassword: string) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);
	const passwordHash = await hashPassword(newPassword);
	await users.updateOne({ _id: userId }, { $set: { passwordHash } });
}

export async function findOrCreateUserFromGoogle(profile: GoogleUserProfile) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	let user = await users.findOne({ provider: 'google', googleId: profile.sub });

	if (!user) {
		const existing = await users.findOne({ email: profile.email });
		if (existing && existing.provider !== 'google') {
			// El email ya pertenece a una cuenta credentials — no permitimos hijack
			// automático aunque Google diga que el email está verificado. El usuario
			// debe iniciar sesión con su contraseña.
			throw new EmailAccountConflictError();
		}
		user = existing;
	}

	if (!user) {
		const result = await users.insertOne({
			email: profile.email,
			provider: 'google',
			googleId: profile.sub,
			name: profile.name,
			picture: profile.picture,
			emailVerified: profile.email_verified,
			role: 'user',
			createdAt: new Date()
		} as UserDoc);

		user = await users.findOne({ _id: result.insertedId });
	}

	return user;
}
