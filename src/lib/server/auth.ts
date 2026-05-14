import type { Db, ObjectId } from 'mongodb';
import { MongoServerError } from 'mongodb';
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

function isDuplicateKeyError(error: unknown, field: string): boolean {
	if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
	const keyPattern = (error as MongoServerError & { keyPattern?: Record<string, unknown> })
		.keyPattern;
	return !!keyPattern && Object.prototype.hasOwnProperty.call(keyPattern, field);
}

export async function createUser(email: string, username: string, password: string) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const passwordHash = await hashPassword(password);

	try {
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
	} catch (error) {
		if (isDuplicateKeyError(error, 'email')) throw new EmailAlreadyRegisteredError();
		if (isDuplicateKeyError(error, 'username')) throw new UsernameTakenError();
		throw error;
	}
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

export async function getUserById(userId: ObjectId) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);
	return users.findOne({ _id: userId });
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

export interface ProfileUpdate {
	username?: string;
	name?: string | null;
	picture?: string | null;
}

export async function updateUserProfile(
	userId: ObjectId,
	update: ProfileUpdate
): Promise<UserDoc | null> {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const $set: Partial<UserDoc> = {};
	const $unset: Partial<Record<keyof UserDoc, ''>> = {};

	if (update.username !== undefined) {
		if (!USERNAME_REGEX.test(update.username)) {
			throw new Error(
				'El nombre de usuario debe tener 3-20 caracteres y solo letras, números, ".", "_" o "-".'
			);
		}
		$set.username = update.username;
	}

	if (update.name !== undefined) {
		if (update.name === null || update.name === '') {
			$unset.name = '';
		} else {
			$set.name = update.name;
		}
	}

	if (update.picture !== undefined) {
		if (update.picture === null) {
			$unset.picture = '';
		} else {
			$set.picture = update.picture;
		}
	}

	const updateOps: Record<string, unknown> = {};
	if (Object.keys($set).length) updateOps.$set = $set;
	if (Object.keys($unset).length) updateOps.$unset = $unset;
	if (!Object.keys(updateOps).length) return null;

	try {
		// Atómico: devuelve el doc PREVIO (antes del update). Lo retornamos
		// para que el caller pueda borrar la foto anterior sin riesgo de
		// race entre dos updates concurrentes.
		const previous = await users.findOneAndUpdate({ _id: userId }, updateOps, {
			returnDocument: 'before'
		});
		return previous;
	} catch (error) {
		if (isDuplicateKeyError(error, 'username')) throw new UsernameTakenError();
		throw error;
	}
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

	const email = profile.email.toLowerCase();

	let user = await users.findOne({ provider: 'google', googleId: profile.sub });

	if (!user) {
		const existing = await users.findOne({ email });
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
			email,
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
