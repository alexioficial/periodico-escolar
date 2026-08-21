import crypto from 'crypto';
import { MongoServerError, type Collection, type Db, type ObjectId } from 'mongodb';
import { emailShouldBeVerified, type EmailAuthSource } from './authEmailPolicy';

const USERS_COLLECTION = 'users';

interface MaterializedUser {
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

function isDuplicateEmailError(error: unknown): boolean {
	if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
	const keyPattern = (error as MongoServerError & { keyPattern?: Record<string, unknown> })
		.keyPattern;
	return !!keyPattern && Object.prototype.hasOwnProperty.call(keyPattern, 'email');
}

export async function generateUniqueUsernameInDb(db: Db, email: string): Promise<string> {
	const users = db.collection<MaterializedUser>(USERS_COLLECTION);
	let base = email
		.split('@')[0]
		.toLowerCase()
		.replace(/[^a-z0-9_.-]/g, '');
	if (base.length < 3) base = `user${base}`;
	base = base.slice(0, 16);

	if (!(await users.findOne({ username: base }))) return base;

	for (let i = 0; i < 10; i++) {
		const suffix = Math.floor(Math.random() * 9000 + 1000);
		const candidate = `${base.slice(0, 15)}-${suffix}`.slice(0, 20);
		if (!(await users.findOne({ username: candidate }))) return candidate;
	}

	return `user-${crypto.randomBytes(4).toString('hex')}`;
}

async function applyRequiredEmailVerification(
	users: Collection<MaterializedUser>,
	user: MaterializedUser,
	verifyEmail: boolean
): Promise<MaterializedUser> {
	if (verifyEmail && user.emailVerified !== true) {
		await users.updateOne({ _id: user._id }, { $set: { emailVerified: true } });
		user.emailVerified = true;
	}
	return user;
}

export async function findOrCreateUserByEmailInDb(
	db: Db,
	email: string,
	source: EmailAuthSource = 'magic-link'
) {
	if (typeof email !== 'string' || !email) throw new Error('Email inválido');

	const users = db.collection<MaterializedUser>(USERS_COLLECTION);
	const normalized = email.toLowerCase();
	const verifyEmail = emailShouldBeVerified(source);
	const existing = await users.findOne({ email: normalized });

	if (existing) return applyRequiredEmailVerification(users, existing, verifyEmail);

	const username = await generateUniqueUsernameInDb(db, normalized);
	try {
		const result = await users.insertOne({
			email: normalized,
			username,
			createdAt: new Date(),
			provider: 'credentials',
			emailVerified: verifyEmail,
			role: 'user'
		} as MaterializedUser);
		return users.findOne({ _id: result.insertedId });
	} catch (error) {
		// Otra request creó la cuenta entre el findOne y el insert.
		if (isDuplicateEmailError(error)) {
			const concurrentUser = await users.findOne({ email: normalized });
			return concurrentUser
				? applyRequiredEmailVerification(users, concurrentUser, verifyEmail)
				: null;
		}
		throw error;
	}
}
