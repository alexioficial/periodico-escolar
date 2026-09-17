import assert from 'node:assert/strict';
import test from 'node:test';

test('clasifica internos, externos, confianza exacta y enlaces inseguros', async () => {
	const { decideArticleLink } = await import('../src/lib/externalLinks.ts');
	const user = { _id: 'one', trustedDomains: ['example.com'] };
	for (const [href, account, expected] of [
		['/feed', null, 'internal'],
		['https://paper.test/post/1', null, 'internal'],
		['https://example.com/a', user, 'trusted'],
		['https://sub.example.com', user, 'warn'],
		['https://example.com', null, 'warn'],
		['https://other.test', user, 'warn'],
		['javascript:alert(1)', user, 'blocked'],
		['//evil.test', user, 'blocked']
	] as const)
		assert.equal(decideArticleLink(href, 'https://paper.test', account).kind, expected);
});

test('solicitar y cancelar no navegan; continuar abre antes de guardar y fallo no concede confianza', async () => {
	const { createExternalLinkFlow } = await import('../src/lib/externalLinks.ts');
	const events: string[] = [];
	const flow = createExternalLinkFlow({
		open: (href: string) => events.push(href),
		saveTrust: async () => {
			events.push('save');
			throw new Error('offline');
		},
		onSaved: () => {
			events.push('trusted');
		},
		onError: () => events.push('error')
	});
	flow.request('https://example.com');
	assert.deepEqual(events, []);
	flow.cancel();
	await flow.continue(true);
	assert.deepEqual(events, []);
	flow.request('https://example.com');
	const pending = flow.continue(true);
	assert.equal(events[0], 'https://example.com/');
	await pending;
	assert.deepEqual(events, ['https://example.com/', 'save', 'error']);
});
