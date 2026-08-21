export type EmailAuthSource = 'magic-link' | 'qa-bypass';

export function emailShouldBeVerified(source: EmailAuthSource): boolean {
	return source === 'magic-link' || source === 'qa-bypass';
}
