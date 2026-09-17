import { normalizeSafeUrl, isTrustedUrl } from './trustedDomains';

type LinkAccount = { _id: string; trustedDomains: string[] } | null;
export type LinkDecision =
	| { kind: 'blocked' }
	| { kind: 'internal' | 'trusted' | 'warn'; href: string; hostname: string };

export function decideArticleLink(value: string, origin: string, user: LinkAccount): LinkDecision {
	const href = normalizeSafeUrl(value);
	if (!href) return { kind: 'blocked' };
	const url = new URL(href, origin);
	const kind =
		url.origin === origin
			? 'internal'
			: user && isTrustedUrl(href, user.trustedDomains)
				? 'trusted'
				: 'warn';
	return { kind, href: url.href, hostname: url.hostname };
}

export function createExternalLinkFlow(effects: {
	open: (href: string) => void;
	saveTrust: (href: string) => Promise<void>;
	onSaved: () => void | Promise<void>;
	onError: () => void;
}) {
	let pending: string | null = null;
	return {
		request(href: string) {
			pending = normalizeSafeUrl(href);
		},
		cancel() {
			pending = null;
		},
		async continue(trust: boolean) {
			const href = pending;
			pending = null;
			if (!href) return;
			// Must happen synchronously inside the Continue click, before any network await.
			effects.open(href);
			if (!trust) return;
			try {
				await effects.saveTrust(href);
				await effects.onSaved();
			} catch {
				effects.onError();
			}
		}
	};
}
