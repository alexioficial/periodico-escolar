import assert from 'node:assert/strict';
import test from 'node:test';

type AuthModule = {
	emailShouldBeVerified?: (source: 'magic-link' | 'qa-bypass') => boolean;
};

async function loadModule(): Promise<AuthModule> {
	return import('../src/lib/server/authEmailPolicy.ts').catch(() => ({}));
}

test('solo una prueba real del inbox marca el correo como verificado', async () => {
	const { emailShouldBeVerified } = await loadModule();
	assert.equal(typeof emailShouldBeVerified, 'function');
	assert.equal(emailShouldBeVerified?.('magic-link'), true);
	assert.equal(emailShouldBeVerified?.('qa-bypass'), false);
});
