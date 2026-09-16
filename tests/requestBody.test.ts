import assert from 'node:assert/strict';
import test from 'node:test';
import { LimitedJsonBodyError, readLimitedJsonBody } from '../src/lib/server/requestBody.ts';

test('lee un body JSON pequeño', async () => {
	const request = new Request('https://example.test/like', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ liked: true })
	});
	assert.deepEqual(await readLimitedJsonBody(request, 64), { liked: true });
});

test('rechaza el body antes de acumular más bytes que el límite', async () => {
	const request = new Request('https://example.test/like', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ payload: 'x'.repeat(200) })
	});
	await assert.rejects(
		readLimitedJsonBody(request, 64),
		(error: unknown) => error instanceof LimitedJsonBodyError && error.status === 413
	);
});

test('rechaza tipos de contenido no JSON y JSON malformado', async () => {
	const textRequest = new Request('https://example.test/like', {
		method: 'POST',
		headers: { 'Content-Type': 'text/plain' },
		body: '{"liked":true}'
	});
	await assert.rejects(
		readLimitedJsonBody(textRequest, 64),
		(error: unknown) => error instanceof LimitedJsonBodyError && error.status === 415
	);

	const malformedRequest = new Request('https://example.test/like', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{'
	});
	await assert.rejects(
		readLimitedJsonBody(malformedRequest, 64),
		(error: unknown) => error instanceof LimitedJsonBodyError && error.status === 400
	);
});
