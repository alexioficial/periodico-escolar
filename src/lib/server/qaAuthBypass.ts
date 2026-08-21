import crypto from 'node:crypto';

const MIN_SECRET_LENGTH = 32;
const GRANT_TTL_MS = 5 * 60_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_SHA256_REGEX = /^[a-f0-9]{64}$/;

export const QA_AUTH_GRANT_COOKIE = 'qa_auth_grant';

interface QaAuthBypassInput {
	enabled: string | undefined;
	configuredSecret: string | undefined;
	providedSecret: unknown;
}

export function isQaAuthBypassAuthorized({
	enabled,
	configuredSecret,
	providedSecret
}: QaAuthBypassInput): boolean {
	if (enabled !== 'true' || typeof providedSecret !== 'string') return false;
	const configuredVersion = getQaAuthVersion(configuredSecret);
	const providedVersion = getQaAuthVersion(providedSecret);
	return safeVersionEqual(configuredVersion, providedVersion);
}

export function normalizeQaAuthBypassEmail(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const email = value.trim().toLowerCase();
	return email && email.length <= 254 && EMAIL_REGEX.test(email) ? email : null;
}

export function getQaAuthVersion(configuredSecret: string | undefined): string | null {
	if (typeof configuredSecret !== 'string' || configuredSecret.length < MIN_SECRET_LENGTH) {
		return null;
	}
	return crypto.createHash('sha256').update(configuredSecret).digest('hex');
}

function safeVersionEqual(left: unknown, right: unknown): boolean {
	if (
		typeof left !== 'string' ||
		typeof right !== 'string' ||
		!HEX_SHA256_REGEX.test(left) ||
		!HEX_SHA256_REGEX.test(right)
	) {
		return false;
	}
	return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function createQaAuthGrant({
	enabled,
	configuredSecret,
	now = Date.now()
}: {
	enabled: string | undefined;
	configuredSecret: string | undefined;
	now?: number;
}): string | null {
	if (enabled !== 'true' || !getQaAuthVersion(configuredSecret)) return null;
	const expiresAt = now + GRANT_TTL_MS;
	const signature = crypto
		.createHmac('sha256', configuredSecret as string)
		.update(`qa-auth-grant:${expiresAt}`)
		.digest('hex');
	return `${expiresAt}.${signature}`;
}

export function isQaAuthGrantAuthorized({
	enabled,
	configuredSecret,
	grant,
	now = Date.now()
}: {
	enabled: string | undefined;
	configuredSecret: string | undefined;
	grant: unknown;
	now?: number;
}): boolean {
	if (enabled !== 'true' || !getQaAuthVersion(configuredSecret) || typeof grant !== 'string') {
		return false;
	}

	const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(grant);
	if (!match) return false;
	const expiresAt = Number(match[1]);
	if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

	const expectedSignature = crypto
		.createHmac('sha256', configuredSecret as string)
		.update(`qa-auth-grant:${expiresAt}`)
		.digest('hex');
	return safeVersionEqual(expectedSignature, match[2]);
}

export function isQaAuthVersionActive({
	enabled,
	configuredSecret,
	version
}: {
	enabled: string | undefined;
	configuredSecret: string | undefined;
	version: unknown;
}): boolean {
	if (enabled !== 'true') return false;
	return safeVersionEqual(getQaAuthVersion(configuredSecret), version);
}
