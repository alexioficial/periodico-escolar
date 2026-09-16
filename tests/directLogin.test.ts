import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectLoginSession } from '../src/lib/server/directLogin.ts';

test('rechaza IDs malformados sin consultar ni crear sesiones', async () => {
	let calls = 0;
	const token = await createDirectLoginSession(
		'not-an-id',
		async () => {
			calls++;
			return null;
		},
		async () => {
			calls++;
			return 'token';
		}
	);
	assert.equal(token, null);
	assert.equal(calls, 0);
});

test('un ID inexistente no crea una sesión', async () => {
	let issued = false;
	const token = await createDirectLoginSession(
		'507f1f77bcf86cd799439011',
		async () => null,
		async () => {
			issued = true;
			return 'token';
		}
	);
	assert.equal(token, null);
	assert.equal(issued, false);
});

test('crea una sesión para el usuario existente de ese ID', async () => {
	const token = await createDirectLoginSession(
		'507f1f77bcf86cd799439011',
		async (id) => ({ _id: id }),
		async (id) => `session:${id.toHexString()}`
	);
	assert.equal(token, 'session:507f1f77bcf86cd799439011');
});
