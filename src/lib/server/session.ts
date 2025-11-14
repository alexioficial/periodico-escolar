import { ObjectId, type Db } from 'mongodb';
import crypto from 'crypto';
import { getDb } from './db';

const SESSIONS_COLLECTION = 'sessions';
const SESSION_TTL_DAYS = 7;

function getExpiryDate() {
	const expires = new Date();
	expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
	return expires;
}

export interface SessionDoc {
	_id: ObjectId;
	token: string;
	userId: ObjectId;
	createdAt: Date;
	expiresAt: Date;
}

export async function createSession(userId: ObjectId): Promise<string> {
	const db: Db = await getDb();
	const sessions = db.collection<SessionDoc>(SESSIONS_COLLECTION);

	const token = crypto.randomBytes(32).toString('hex');

	const session: Omit<SessionDoc, '_id'> = {
		token,
		userId,
		createdAt: new Date(),
		expiresAt: getExpiryDate()
	};

	await sessions.insertOne(session as SessionDoc);

	return token;
}

export async function getUserBySessionToken(token: string) {
	const db: Db = await getDb();
	const sessions = db.collection<SessionDoc>(SESSIONS_COLLECTION);

	const session = await sessions.findOne({ token });
	if (!session) return null;

	if (session.expiresAt < new Date()) {
		await sessions.deleteOne({ _id: session._id });
		return null;
	}

	const users = db.collection('users');
	const user = await users.findOne({ _id: session.userId });

	return user;
}

export async function deleteSession(token: string) {
	const db: Db = await getDb();
	const sessions = db.collection<SessionDoc>(SESSIONS_COLLECTION);
	await sessions.deleteOne({ token });
}
