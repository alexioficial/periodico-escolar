import type { Db, ObjectId } from 'mongodb';
import crypto from 'crypto';
import { getDb } from './db';
import { sendMagicLinkEmail } from './mailer';

const COLLECTION = 'magic_login_tokens';
const TTL_MINUTES = 15;

export interface MagicLinkDoc {
	_id: ObjectId;
	email: string;
	tokenHash: string;
	returnTo: string;
	createdAt: Date;
	expiresAt: Date;
	used: boolean;
}

function sha256(input: string): string {
	return crypto.createHash('sha256').update(input).digest('hex');
}

function expiryDate(): Date {
	const d = new Date();
	d.setMinutes(d.getMinutes() + TTL_MINUTES);
	return d;
}

export async function createMagicLink(
	email: string,
	origin: string,
	returnTo: string
): Promise<void> {
	if (typeof email !== 'string' || !email) return;
	if (typeof origin !== 'string' || !origin) return;

	const db: Db = await getDb();
	const col = db.collection<MagicLinkDoc>(COLLECTION);

	// Token plano de 32 bytes (64 hex). Lo enviamos por mail; en la DB solo
	// guardamos su SHA-256 para que una fuga de DB no permita login.
	const plainToken = crypto.randomBytes(32).toString('hex');
	const tokenHash = sha256(plainToken);

	// Un único documento por email: dos solicitudes concurrentes no pueden
	// dejar dos enlaces activos. El índice único de email refuerza el upsert.
	await col.updateOne(
		{ email },
		{
			$set: {
				tokenHash,
				returnTo,
				createdAt: new Date(),
				expiresAt: expiryDate(),
				used: false
			}
		},
		{ upsert: true }
	);

	const url = `${origin}/auth/m/${plainToken}`;
	await sendMagicLinkEmail(email, url);
}

export type ConsumeResult =
	| { ok: true; email: string; returnTo: string }
	| { ok: false; reason: 'not_found' | 'expired' | 'used' };

export async function consumeMagicLink(plainToken: string): Promise<ConsumeResult> {
	if (typeof plainToken !== 'string' || !/^[a-f0-9]{64}$/.test(plainToken)) {
		return { ok: false, reason: 'not_found' };
	}

	const tokenHash = sha256(plainToken);
	const db: Db = await getDb();
	const col = db.collection<MagicLinkDoc>(COLLECTION);

	const now = new Date();
	const consumed = await col.findOneAndUpdate(
		{ tokenHash, used: false, expiresAt: { $gt: now } },
		{ $set: { used: true } },
		{ returnDocument: 'before' }
	);
	if (consumed) {
		return { ok: true, email: consumed.email, returnTo: consumed.returnTo };
	}

	// Esta lectura sólo clasifica el error. La autorización ya se decidió de
	// forma atómica arriba, por lo que dos requests nunca obtienen `ok: true`.
	const existing = await col.findOne({ tokenHash });
	if (!existing) return { ok: false, reason: 'not_found' };
	if (existing.used) return { ok: false, reason: 'used' };
	if (existing.expiresAt <= now) {
		await col.deleteOne({ _id: existing._id });
		return { ok: false, reason: 'expired' };
	}
	return { ok: false, reason: 'not_found' };
}
