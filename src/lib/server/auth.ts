import type { Db, ObjectId } from 'mongodb';
import { MongoServerError } from 'mongodb';
import { getDb } from './db';
import { findOrCreateUserByEmailInDb } from './authUserMaterialization';
import { findOrCreateGoogleUserInDb, type GoogleUserProfile } from './googleUserMaterialization';

const USERS_COLLECTION = 'users';

interface UserDoc {
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
	trustedDomains?: string[];
}

export class UsernameTakenError extends Error {
	constructor() {
		super('El nombre de usuario ya está en uso');
		this.name = 'UsernameTakenError';
	}
}

function isDuplicateKeyError(error: unknown, field: string): boolean {
	if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
	const keyPattern = (error as MongoServerError & { keyPattern?: Record<string, unknown> })
		.keyPattern;
	return !!keyPattern && Object.prototype.hasOwnProperty.call(keyPattern, field);
}

export async function getUserById(userId: ObjectId) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);
	return users.findOne({ _id: userId });
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

// Materializa usuarios que demostraron controlar su correo mediante magic link.
// La política institucional se aplica dentro del materializador antes de insertar.
export async function findOrCreateUserByEmail(email: string) {
	const db: Db = await getDb();
	return findOrCreateUserByEmailInDb(db, email);
}

export async function getUserByEmail(email: string) {
	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);
	return users.findOne({ email: email.trim().toLowerCase() });
}

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
			if (
				typeof update.picture !== 'string' ||
				!/^uploads\/[a-z0-9-]+(?:\.[a-z0-9]+)?$/.test(update.picture)
			) {
				throw new Error('La referencia de la foto de perfil no es válida');
			}
			$set.picture = update.picture;
		}
	}

	if (update.name !== undefined && typeof update.name === 'string' && update.name.length > 100) {
		throw new Error('El nombre es demasiado largo');
	}

	const updateOps: Record<string, unknown> = {};
	if (Object.keys($set).length) updateOps.$set = $set;
	if (Object.keys($unset).length) updateOps.$unset = $unset;
	if (!Object.keys(updateOps).length) return null;

	try {
		const previous = await users.findOneAndUpdate({ _id: userId }, updateOps, {
			returnDocument: 'before'
		});
		return previous;
	} catch (error) {
		if (isDuplicateKeyError(error, 'username')) throw new UsernameTakenError();
		throw error;
	}
}

// Google OAuth. Match preferente por googleId (estable si el usuario cambia
// su correo en Google). Si no, busca por correo y unifica con esa cuenta.
// Si no existe, crea una nueva con username auto-generado.
export async function findOrCreateUserFromGoogle(profile: GoogleUserProfile) {
	const db: Db = await getDb();
	return findOrCreateGoogleUserInDb(db, profile);
}
