import assert from 'node:assert/strict';
import test from 'node:test';
import { safeReturnTo } from '../src/lib/server/redirect.ts';

test('safeReturnTo conserva rutas internas', () => {
	assert.equal(safeReturnTo('/feed?page=2#latest', '/feed'), '/feed?page=2#latest');
});

test('safeReturnTo rechaza URLs absolutas y protocol-relative', () => {
	assert.equal(safeReturnTo('https://evil.example', '/feed'), '/feed');
	assert.equal(safeReturnTo('//evil.example', '/feed'), '/feed');
});

test('safeReturnTo rechaza variantes con backslash que el navegador normaliza', () => {
	assert.equal(safeReturnTo('/\\evil.example', '/feed'), '/feed');
	assert.equal(safeReturnTo('/\\\\evil.example', '/feed'), '/feed');
});
