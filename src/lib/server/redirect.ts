/**
 * Acepta únicamente destinos internos. Usar `startsWith('/')` no alcanza:
 * los navegadores normalizan backslashes y `/<backslash>evil.test` termina
 * siendo una redirección externa.
 */
export function safeReturnTo(raw: unknown, fallback: string): string {
	if (typeof raw !== 'string' || !raw || !fallback.startsWith('/')) return fallback;
	if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;

	try {
		const base = 'https://internal.invalid';
		const parsed = new URL(raw, base);
		if (parsed.origin !== base) return fallback;
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return fallback;
	}
}
