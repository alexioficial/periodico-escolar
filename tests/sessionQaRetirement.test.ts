import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionIsAllowed } from '../src/lib/server/sessionPolicy.ts';

test('rechaza todas las sesiones creadas con el bypass QA anterior', () => {
	assert.equal(sessionIsAllowed({ qaAuthVersion: 'legacy' }), false);
	assert.equal(sessionIsAllowed({ qaAuthVersion: '' }), false);
});

test('mantiene las sesiones ordinarias', () => {
	assert.equal(sessionIsAllowed({}), true);
	assert.equal(sessionIsAllowed({ qaAuthVersion: undefined }), true);
});
