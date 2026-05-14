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

// Parámetros explícitos de argon2 alineados con la guía OWASP 2024 (argon2id).
// Fijarlos previene cambios silenciosos entre versiones de la lib y deja claros
// los trade-offs CPU/memoria.
const ARGON2_OPTIONS = {
	type: argon2.argon2id,
	memoryCost: 19_456, // 19 MiB
	timeCost: 2,
	parallelism: 1
} as const;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// Hash dummy para que `validateUser` corra argon2.verify aún cuando el usuario
// no existe, evitando enumerar emails por timing. Se genera lazy en la primera
// llamada y se cachea — así garantizamos un hash con los mismos parámetros que
// usamos en producción.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
	if (!dummyHashPromise) {
		dummyHashPromise = argon2.hash('dummy-password-for-timing', ARGON2_OPTIONS);
	}
	return dummyHashPromise;
}

export async function hashPassword(password: string) {
	if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
		throw new Error(`La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`);
	}
	return argon2.hash(password, ARGON2_OPTIONS);
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
	if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
		throw new Error('Datos de registro inválidos');
	}

	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const passwordHash = await hashPassword(password); // valida longitud

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
	if (typeof email !== 'string' || typeof password !== 'string') return null;

	const db: Db = await getDb();
	const users = db.collection<UserDoc>(USERS_COLLECTION);

	const user = await users.findOne({ email, provider: 'credentials' });

	// Para no enumerar emails por timing, corremos `verify` aún cuando el
	// usuario no existe (o no tiene passwordHash). El verify contra el dummy
	// devuelve false; descartamos la rama del usuario válido sólo después.
	const hashToCheck = user?.passwordHash || (await getDummyHash());
	const ok = await verifyPassword(hashToCheck, password);

	if (!user || !user.passwordHash || !ok) return null;
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
			// Sólo aceptamos keys internas (subidas vía storage.saveFile, que
			// devuelve `uploads/<uuid>[.ext]`). Esto evita que un caller arme
			// el form con una URL externa o una key apuntando a otro recurso.
			if (typeof update.picture !== 'string' || !/^uploads\/[a-z0-9-]+(?:\.[a-z0-9]+)?$/.test(update.picture)) {
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
	const passwordHash = await hashPassword(newPassword); // valida longitud
	const res = await users.updateOne({ _id: userId }, { $set: { passwordHash } });
	if (res.matchedCount !== 1) {
		throw new Error('No se encontró el usuario al actualizar la contraseña');
	}
}

export async function findOrCreateUserFromGoogle(profile: GoogleUserProfile) {
	if (typeof profile?.sub !== 'string' || typeof profile?.email !== 'string') {
		throw new Error('Perfil de Google inválido');
	}

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
		// Atómico: si dos requests OAuth llegan al mismo tiempo, sólo uno
		// inserta y ambos terminan apuntando al mismo doc (insertedId vía
		// upsert). Sin esto, podían crearse cuentas duplicadas.
		try {
			await users.updateOne(
				{ provider: 'google', googleId: profile.sub },
				{
					$setOnInsert: {
						email,
						provider: 'google',
						googleId: profile.sub,
						name: profile.name,
						picture: profile.picture,
						emailVerified: profile.email_verified,
						role: 'user',
						createdAt: new Date()
					}
				},
				{ upsert: true }
			);
		} catch (error) {
			if (isDuplicateKeyError(error, 'email')) {
				// Otra request creó la cuenta credentials entre nuestro check y
				// el upsert. Tratamos igual que existing credentials.
				throw new EmailAccountConflictError();
			}
			throw error;
		}
		user = await users.findOne({ provider: 'google', googleId: profile.sub });
	}

	return user;
}
