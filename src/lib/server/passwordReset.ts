import { ObjectId, type Db } from 'mongodb';
import { randomInt } from 'crypto';
import { getDb } from './db';
import { sendPasswordResetEmail } from './mailer';
import { setUserPassword } from './auth';

const CODES_COLLECTION = 'password_reset_codes';
const USERS_COLLECTION = 'users';
const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function generate6DigitCode() {
	return randomInt(100000, 1000000).toString();
}

function expiryDate(minutes = CODE_TTL_MINUTES) {
	const d = new Date();
	d.setMinutes(d.getMinutes() + minutes);
	return d;
}

export interface PasswordResetCodeDoc {
	_id: ObjectId;
	email: string;
	userId: ObjectId;
	code: string;
	createdAt: Date;
	expiresAt: Date;
	attempts: number;
}

export async function createAndSendResetCode(email: string) {
	const db: Db = await getDb();
	const users = db.collection(USERS_COLLECTION);
	const codes = db.collection<PasswordResetCodeDoc>(CODES_COLLECTION);

	const user = await users.findOne({ email, provider: 'credentials' });
	if (!user) {
		// No revelamos si el email existe o no — comportamiento silencioso.
		return;
	}

	const code = generate6DigitCode();

	await codes.deleteMany({ email });
	await codes.insertOne({
		email,
		userId: user._id,
		code,
		createdAt: new Date(),
		expiresAt: expiryDate(),
		attempts: 0
	} as PasswordResetCodeDoc);

	await sendPasswordResetEmail(email, code);
}

export async function verifyResetCode(email: string, code: string, newPassword: string) {
	const db: Db = await getDb();
	const codes = db.collection<PasswordResetCodeDoc>(CODES_COLLECTION);

	const doc = await codes.findOne({ email });
	if (!doc) return { ok: false, reason: 'not_found' as const };

	if (doc.expiresAt < new Date()) {
		await codes.deleteOne({ _id: doc._id });
		return { ok: false, reason: 'expired' as const };
	}

	if (doc.attempts >= MAX_ATTEMPTS) {
		await codes.deleteOne({ _id: doc._id });
		return { ok: false, reason: 'too_many_attempts' as const };
	}

	if (doc.code !== code) {
		await codes.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
		return { ok: false, reason: 'invalid_code' as const };
	}

	await setUserPassword(doc.userId, newPassword);
	await codes.deleteOne({ _id: doc._id });
	return { ok: true as const };
}
