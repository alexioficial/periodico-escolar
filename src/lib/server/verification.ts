import { ObjectId, type Db } from 'mongodb';
import { randomInt, timingSafeEqual } from 'crypto';
import { getDb } from './db';
import { sendVerificationEmail } from './mailer';

const CODES_COLLECTION = 'email_verification_codes';
const USERS_COLLECTION = 'users';
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generate6DigitCode() {
	return randomInt(100000, 1000000).toString();
}

function expiryDate(minutes = CODE_TTL_MINUTES) {
	const d = new Date();
	d.setMinutes(d.getMinutes() + minutes);
	return d;
}

export interface VerificationCodeDoc {
	_id: ObjectId;
	email: string;
	userId: ObjectId;
	code: string;
	createdAt: Date;
	expiresAt: Date;
	attempts: number;
}

function safeEqualStrings(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export async function createAndSendVerificationCode(email: string) {
	if (typeof email !== 'string' || !email) return;

	const db: Db = await getDb();
	const users = db.collection(USERS_COLLECTION);
	const codes = db.collection<VerificationCodeDoc>(CODES_COLLECTION);

	// Sólo emitimos código para cuentas con contraseña que aún no verificaron.
	// Silenciamos el caso de "no existe" / "ya verificada" / Google para no
	// revelar qué emails están registrados.
	const user = await users.findOne({
		email,
		provider: 'credentials',
		emailVerified: { $ne: true }
	});
	if (!user) return;

	const code = generate6DigitCode();

	await codes.deleteMany({ email });
	await codes.insertOne({
		email,
		userId: user._id,
		code,
		createdAt: new Date(),
		expiresAt: expiryDate(),
		attempts: 0
	} as VerificationCodeDoc);

	await sendVerificationEmail(email, code);
}

export async function verifyEmailCode(email: string, code: string) {
	if (typeof email !== 'string' || typeof code !== 'string') {
		return { ok: false, reason: 'not_found' as const };
	}

	const db: Db = await getDb();
	const users = db.collection(USERS_COLLECTION);
	const codes = db.collection<VerificationCodeDoc>(CODES_COLLECTION);

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

	// Algunos clientes de correo añaden espacios o caracteres invisibles al copiar
	// (el `letter-spacing` del template puede generar separadores al hacer copy).
	// Normalizamos a sólo dígitos para que un copy/paste con basura siga siendo
	// válido si los 6 dígitos coinciden.
	const inputCode = code.replace(/\D/g, '');

	if (!safeEqualStrings(doc.code, inputCode)) {
		await codes.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
		return { ok: false, reason: 'invalid_code' as const };
	}

	await users.updateOne({ _id: doc.userId }, { $set: { emailVerified: true } });
	await codes.deleteOne({ _id: doc._id });
	return { ok: true as const };
}
