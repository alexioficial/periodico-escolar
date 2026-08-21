import { ObjectId, type Db } from 'mongodb';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';
import { getDb } from './db';
import { isQaAuthVersionActive } from './qaAuthBypass';

const SESSIONS_COLLECTION = 'sessions';
const SESSION_TTL_DAYS = 7;

function getExpiryDate() {
	const expires = new Date();
	expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
	return expires;
}

export interface SessionDoc {
	_id: ObjectId;
	tokenHash: string;
	/** Campo legado; se migra a tokenHash al iniciar. */
	token?: string;
	userId: ObjectId;
	createdAt: Date;
	expiresAt: Date;
	qaAuthVersion?: string;
}

function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
	userId: ObjectId,
	options: { qaAuthVersion?: string } = {}
): Promise<string> {
	const db: Db = await getDb();
	const sessions = db.collection<SessionDoc>(SESSIONS_COLLECTION);

	const token = crypto.randomBytes(32).toString('hex');

	const session: Omit<SessionDoc, '_id'> = {
		tokenHash: hashToken(token),
		userId,
		createdAt: new Date(),
		expiresAt: getExpiryDate()
	};
	if (options.qaAuthVersion) session.qaAuthVersion = options.qaAuthVersion;

	await sessions.insertOne(session as SessionDoc);

	return token;
}

// Tokens son hex de 64 chars (256 bits) generados con randomBytes. Validamos
// formato antes de tocar Mongo para evitar inyección si alguien refactorea
// la entrada y pasa algo que no sea string.
const TOKEN_REGEX = /^[a-f0-9]{64}$/;

export async function getUserBySessionToken(token: string) {
	if (typeof token !== 'string' || !TOKEN_REGEX.test(token)) return null;

	const db: Db = await getDb();
	const sessions = db.collection<SessionDoc>(SESSIONS_COLLECTION);

	const tokenHash = hashToken(token);
	const session = await sessions.findOne({ $or: [{ tokenHash }, { token }] });
	if (!session) return null;
	if (
		session.qaAuthVersion &&
		!isQaAuthVersionActive({
			enabled: env.QA_AUTH_BYPASS_ENABLED,
			configuredSecret: env.QA_AUTH_BYPASS_SECRET,
			version: session.qaAuthVersion
		})
	) {
		await sessions.deleteOne({ _id: session._id });
		return null;
	}
	if (session.token) {
		await sessions.updateOne(
			{ _id: session._id, token: session.token },
			{ $set: { tokenHash }, $unset: { token: '' } }
		);
	}

	if (session.expiresAt < new Date()) {
		await sessions.deleteOne({ _id: session._id });
		return null;
	}

	const users = db.collection('users');
	const user = await users.findOne({ _id: session.userId });

	return user;
}

export async function deleteSession(token: string) {
	if (typeof token !== 'string' || !TOKEN_REGEX.test(token)) return;
	const db: Db = await getDb();
	const sessions = db.collection<SessionDoc>(SESSIONS_COLLECTION);
	await sessions.deleteOne({ $or: [{ tokenHash: hashToken(token) }, { token }] });
}

// Invalidación masiva: usar tras cambio de contraseña, reset, o cambio de rol
// para forzar re-login en todos los dispositivos del usuario.
export async function deleteAllSessionsForUser(userId: ObjectId) {
	const db: Db = await getDb();
	const sessions = db.collection<SessionDoc>(SESSIONS_COLLECTION);
	await sessions.deleteMany({ userId });
}
