import { MongoServerError, type Db, type ObjectId } from 'mongodb';
import { assertInstitutionalEmailForNewAccount, normalizeEmail } from './authEmailPolicy';
import { generateUniqueUsernameInDb } from './authUserMaterialization';

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

export interface GoogleUserProfile {
	sub: string;
	email: string;
	name?: string;
	picture?: string;
	email_verified?: boolean;
}

function isDuplicateKeyError(error: unknown, field: string): boolean {
	if (!(error instanceof MongoServerError) || error.code !== 11000) return false;
	const keyPattern = (error as MongoServerError & { keyPattern?: Record<string, unknown> })
		.keyPattern;
	return !!keyPattern && Object.prototype.hasOwnProperty.call(keyPattern, field);
}

export async function findOrCreateGoogleUserInDb(db: Db, profile: GoogleUserProfile) {
	if (typeof profile?.sub !== 'string' || typeof profile?.email !== 'string') {
		throw new Error('Perfil de Google inválido');
	}
	if (profile.email_verified !== true) {
		throw new Error('Google no confirmó que el correo esté verificado');
	}

	const users = db.collection<UserDoc>(USERS_COLLECTION);
	const email = normalizeEmail(profile.email);
	if (!email) throw new Error('Perfil de Google inválido');

	const byGoogleId = await users.findOne({ googleId: profile.sub });
	if (byGoogleId) return byGoogleId;

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

	assertInstitutionalEmailForNewAccount(email);

	const username = await generateUniqueUsernameInDb(db, email);
	try {
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
	} catch (error) {
		if (isDuplicateKeyError(error, 'email')) {
			const concurrentUser = await users.findOne({ email });
			if (concurrentUser) {
				await users.updateOne(
					{ _id: concurrentUser._id },
					{ $set: { googleId: profile.sub, emailVerified: true } }
				);
				return users.findOne({ _id: concurrentUser._id });
			}
		}
		throw error;
	}
	return users.findOne({ googleId: profile.sub });
}
