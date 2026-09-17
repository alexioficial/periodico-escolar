export const MAX_TRUSTED_DOMAINS = 100;
export const MAX_SAFE_URL_LENGTH = 2048;

/** Shared browser/server validation; reject dangerous syntax before WHATWG normalization. */
export function normalizeSafeUrl(value: unknown): string | null {
	if (
		typeof value !== 'string' ||
		value.length > MAX_SAFE_URL_LENGTH ||
		// Intentionally reject ASCII controls before URL parsing can silently strip them.
		// eslint-disable-next-line no-control-regex
		/[\\\x00-\x1f\x7f]/.test(value)
	)
		return null;
	const input = value.trim();
	if (!input) return null;
	if (input.startsWith('/') && !input.startsWith('//')) return input;
	const authority = /^https?:\/\/([^/?#]+)/i.exec(input)?.[1];
	if (!authority || authority.includes('@')) return null;
	try {
		const url = new URL(input);
		if (
			!['http:', 'https:'].includes(url.protocol) ||
			!url.hostname ||
			url.username ||
			url.password
		)
			return null;
		const normalized = url.href;
		return normalized.length <= MAX_SAFE_URL_LENGTH ? normalized : null;
	} catch {
		return null;
	}
}

/** Exact lowercase ASCII DNS hostname, never a URL, wildcard or suffix rule. */
export function normalizeTrustedDomain(value: unknown): string | null {
	if (typeof value !== 'string' || value.length > 254 || /[^\x21-\x7e]/.test(value)) return null;
	const hostname = value.toLowerCase().replace(/\.$/, '');
	if (!hostname || hostname.length > 253) return null;
	return hostname.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
		? hostname
		: null;
}

export function getTrustedDomainFromUrl(value: unknown): string | null {
	const safeUrl = normalizeSafeUrl(value);
	if (!safeUrl || safeUrl.startsWith('/')) return null;
	return normalizeTrustedDomain(new URL(safeUrl).hostname);
}

/** Bound work as well as output when reading legacy/corrupted records. */
export function sanitizeTrustedDomains(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const domains = new Set<string>();
	for (const item of value.slice(0, MAX_TRUSTED_DOMAINS)) {
		const domain = normalizeTrustedDomain(item);
		if (domain) domains.add(domain);
	}
	return [...domains];
}

export function isTrustedUrl(value: unknown, domains: unknown): boolean {
	const safeUrl = normalizeSafeUrl(value);
	if (!safeUrl) return false;
	if (safeUrl.startsWith('/')) return true;
	const domain = getTrustedDomainFromUrl(safeUrl);
	return domain !== null && sanitizeTrustedDomains(domains).includes(domain);
}
