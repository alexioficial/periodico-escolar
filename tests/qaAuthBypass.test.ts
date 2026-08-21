import assert from 'node:assert/strict';
import test from 'node:test';

type QaAuthBypassModule = {
	createQaAuthGrant?: (input: {
		enabled: string | undefined;
		configuredSecret: string | undefined;
		now?: number;
	}) => string | null;
	getQaAuthVersion?: (configuredSecret: string | undefined) => string | null;
	isQaAuthBypassAuthorized?: (input: {
		enabled: string | undefined;
		configuredSecret: string | undefined;
		providedSecret: unknown;
	}) => boolean;
	isQaAuthGrantAuthorized?: (input: {
		enabled: string | undefined;
		configuredSecret: string | undefined;
		grant: unknown;
		now?: number;
	}) => boolean;
	isQaAuthVersionActive?: (input: {
		enabled: string | undefined;
		configuredSecret: string | undefined;
		version: unknown;
	}) => boolean;
	normalizeQaAuthBypassEmail?: (value: unknown) => string | null;
};

async function loadModule(): Promise<QaAuthBypassModule> {
	return import('../src/lib/server/qaAuthBypass.ts').catch(() => ({}));
}

test('autoriza el bypass QA únicamente con el flag activo y el secreto exacto', async () => {
	const { isQaAuthBypassAuthorized } = await loadModule();
	assert.equal(typeof isQaAuthBypassAuthorized, 'function');

	const secret = 'qa-secret-0123456789abcdef0123456789abcdef';
	assert.equal(
		isQaAuthBypassAuthorized?.({
			enabled: 'true',
			configuredSecret: secret,
			providedSecret: secret
		}),
		true
	);
	assert.equal(
		isQaAuthBypassAuthorized?.({
			enabled: 'false',
			configuredSecret: secret,
			providedSecret: secret
		}),
		false
	);
	assert.equal(
		isQaAuthBypassAuthorized?.({
			enabled: 'true',
			configuredSecret: secret,
			providedSecret: `${secret}-incorrecto`
		}),
		false
	);
});

test('rechaza secretos ausentes, no textuales o demasiado cortos', async () => {
	const { isQaAuthBypassAuthorized } = await loadModule();
	assert.equal(typeof isQaAuthBypassAuthorized, 'function');

	for (const input of [
		{ enabled: 'true', configuredSecret: undefined, providedSecret: 'anything' },
		{ enabled: 'true', configuredSecret: 'short', providedSecret: 'short' },
		{ enabled: 'true', configuredSecret: 'x'.repeat(32), providedSecret: null }
	]) {
		assert.equal(isQaAuthBypassAuthorized?.(input), false);
	}
});

test('normaliza correos QA válidos y rechaza entradas inválidas', async () => {
	const { normalizeQaAuthBypassEmail } = await loadModule();
	assert.equal(typeof normalizeQaAuthBypassEmail, 'function');
	assert.equal(
		normalizeQaAuthBypassEmail?.('  QA.User+Admin@Example.COM '),
		'qa.user+admin@example.com'
	);

	for (const value of [null, '', 'sin-arroba', 'a@b', `${'a'.repeat(250)}@example.com`]) {
		assert.equal(normalizeQaAuthBypassEmail?.(value), null);
	}
});

test('canjea el secreto por un grant firmado, corto y sin el secreto original', async () => {
	const { createQaAuthGrant, isQaAuthGrantAuthorized } = await loadModule();
	assert.equal(typeof createQaAuthGrant, 'function');
	assert.equal(typeof isQaAuthGrantAuthorized, 'function');

	const secret = 'qa-secret-0123456789abcdef0123456789abcdef';
	const now = Date.parse('2026-08-21T12:00:00.000Z');
	const grant = createQaAuthGrant?.({ enabled: 'true', configuredSecret: secret, now });
	assert.equal(typeof grant, 'string');
	assert.equal(grant?.includes(secret), false);
	assert.equal(
		isQaAuthGrantAuthorized?.({
			enabled: 'true',
			configuredSecret: secret,
			grant,
			now: now + 4 * 60_000
		}),
		true
	);
	assert.equal(
		isQaAuthGrantAuthorized?.({
			enabled: 'true',
			configuredSecret: secret,
			grant,
			now: now + 6 * 60_000
		}),
		false
	);
	assert.equal(
		isQaAuthGrantAuthorized?.({
			enabled: 'true',
			configuredSecret: `${secret}-rotated`,
			grant,
			now: now + 60_000
		}),
		false
	);
});

test('invalida la versión de una sesión QA al apagar o rotar el secreto', async () => {
	const { getQaAuthVersion, isQaAuthVersionActive } = await loadModule();
	assert.equal(typeof getQaAuthVersion, 'function');
	assert.equal(typeof isQaAuthVersionActive, 'function');

	const secret = 'qa-secret-0123456789abcdef0123456789abcdef';
	const version = getQaAuthVersion?.(secret);
	assert.match(version ?? '', /^[a-f0-9]{64}$/);
	assert.equal(
		isQaAuthVersionActive?.({ enabled: 'true', configuredSecret: secret, version }),
		true
	);
	assert.equal(
		isQaAuthVersionActive?.({ enabled: 'false', configuredSecret: secret, version }),
		false
	);
	assert.equal(
		isQaAuthVersionActive?.({
			enabled: 'true',
			configuredSecret: `${secret}-rotated`,
			version
		}),
		false
	);
});
