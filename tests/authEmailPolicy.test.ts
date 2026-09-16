import assert from 'node:assert/strict';
import test from 'node:test';
import {
	InstitutionalEmailRequiredError,
	assertMagicLinkRequestAllowed,
	assertInstitutionalEmailForNewAccount,
	isInstitutionalEmail,
	normalizeEmail
} from '../src/lib/server/authEmailPolicy.ts';

test('normaliza el correo sin distinguir mayúsculas ni espacios exteriores', () => {
	assert.equal(
		normalizeEmail('  Alumno+Noticias@Salesianos.Edu.Do  '),
		'alumno+noticias@salesianos.edu.do'
	);
});

test('el magic link permite cuentas externas existentes pero no altas externas', () => {
	assert.doesNotThrow(() => assertMagicLinkRequestAllowed('persona@gmail.com', true));
	assert.doesNotThrow(() => assertMagicLinkRequestAllowed('alumno@salesianos.edu.do', false));
	assert.throws(
		() => assertMagicLinkRequestAllowed('nuevo@gmail.com', false),
		InstitutionalEmailRequiredError
	);
});

test('acepta el dominio institucional exacto, incluyendo aliases', () => {
	assert.equal(isInstitutionalEmail('alumno@salesianos.edu.do'), true);
	assert.equal(isInstitutionalEmail('ALUMNO+periodico@SALESIANOS.EDU.DO'), true);
});

test('rechaza subdominios, dominios similares y correos malformados', () => {
	for (const email of [
		'alumno@sub.salesianos.edu.do',
		'alumno@salesianos.edu.do.evil.test',
		'alumno@xsalesianos.edu.do',
		'alumno@salesianos.edu.com',
		'alumno@',
		'@salesianos.edu.do',
		'alumnosalesianos.edu.do'
	]) {
		assert.equal(isInstitutionalEmail(email), false, email);
	}
});

test('el rechazo de un alta externa usa el error de dominio institucional', () => {
	assert.throws(
		() => assertInstitutionalEmailForNewAccount('persona@gmail.com'),
		(error: unknown) =>
			error instanceof InstitutionalEmailRequiredError &&
			error.message === 'Se requiere un correo institucional @salesianos.edu.do'
	);
});
