import assert from 'node:assert/strict';
import test from 'node:test';
import { loginPath, safeReturnTo } from '../src/lib/server/redirect.ts';

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

test('loginPath conserva un destino interno en la ruta canónica de acceso', () => {
	assert.equal(loginPath('/redaccion?draft=1'), '/login?returnTo=%2Fredaccion%3Fdraft%3D1');
});

test('loginPath reemplaza destinos externos por el feed después del acceso', () => {
	assert.equal(loginPath('https://evil.example'), '/login?returnTo=%2Ffeed');
});
