export const INSTITUTIONAL_EMAIL_DOMAIN = 'salesianos.edu.do';

export class InstitutionalEmailRequiredError extends Error {
	constructor() {
		super(`Se requiere un correo institucional @${INSTITUTIONAL_EMAIL_DOMAIN}`);
		this.name = 'InstitutionalEmailRequiredError';
	}
}

export function normalizeEmail(email: string): string {
	return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isInstitutionalEmail(email: string): boolean {
	const normalized = normalizeEmail(email);
	const parts = normalized.split('@');
	return parts.length === 2 && parts[0].length > 0 && parts[1] === INSTITUTIONAL_EMAIL_DOMAIN;
}

export function assertInstitutionalEmailForNewAccount(email: string): void {
	if (!isInstitutionalEmail(email)) throw new InstitutionalEmailRequiredError();
}

export function assertMagicLinkRequestAllowed(email: string, accountExists: boolean): void {
	if (!accountExists) assertInstitutionalEmailForNewAccount(email);
}
