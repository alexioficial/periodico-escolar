import type { Db, ObjectId } from 'mongodb';
import { MongoServerError } from 'mongodb';
import { getDb } from './db';
import type { EmailAuthSource } from './authEmailPolicy';
import { findOrCreateUserByEmailInDb, generateUniqueUsernameInDb } from './authUserMaterialization';

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
}

interface GoogleUserProfile {
	sub: string;
	email: string;
	name?: string;
	picture?: string;
	email_verified?: boolean;
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

// Materializa usuarios de magic-link o del bypass QA. Ambos habilitan los
// flujos que requieren correo verificado; el bypass solo existe con flag y secreto.
export async function findOrCreateUserByEmail(
	email: string,
	source: EmailAuthSource = 'magic-link'
) {
	const db: Db = await getDb();
	return findOrCreateUserByEmailInDb(db, email, source);
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
	if (typeof profile?.sub !== 'string' || typeof profile?.email !== 'string') {
		throw new Error('Perfil de Google inválido');
	}
	if (profile.email_verified !== true) {
		throw new Error('Google no confirmó que el correo esté verificado');
	}

	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);
	const email = profile.email.toLowerCase();

	const byGoogleId = await users.findOne({ googleId: profile.sub });
	if (byGoogleId) return byGoogleId;

	// Mismo correo en otra cuenta (registrada por magic-link previa). Unificamos
	// adjuntando el googleId, marcando verificado y rellenando nombre/foto sólo
	// si todavía no los tenía.
	const byEmail = await users.findOne({ email });
	if (byEmail) {
		const $set: Partial<UserDoc> = {
			googleId: profile.sub,
			emailVerified: true
		};
		if (!byEmail.name && profile.name) $set.name = profile.name;
		if (!byEmail.picture && profile.picture) $set.picture = profile.picture;
		await users.updateOne({ _id: byEmail._id }, { $set });
		return users.findOne({ _id: byEmail._id });
	}

	const username = await generateUniqueUsernameInDb(db, email);
	try {
		// Upsert atómico: si dos callbacks llegan a la vez sólo uno inserta.
		await users.updateOne(
			{ googleId: profile.sub },
			{
				$setOnInsert: {
					email,
					username,
					provider: 'google',
					googleId: profile.sub,
					name: profile.name,
					picture: profile.picture,
					emailVerified: true,
					role: 'user',
					createdAt: new Date()
				}
			},
			{ upsert: true }
		);
	} catch (err) {
		if (isDuplicateKeyError(err, 'email')) {
			return users.findOne({ email });
		}
		throw err;
	}
	return users.findOne({ googleId: profile.sub });
}
