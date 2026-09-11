import assert from 'node:assert/strict';
import test from 'node:test';

type BrandModule = {
	BRAND_NAME?: string;
	BRAND_SUBTITLE?: string;
	brandTitle?: (section?: string) => string;
};

async function loadModule(): Promise<BrandModule> {
	return import('../src/lib/brand.ts').catch(() => ({}));
}

test('expone la identidad oficial del periódico', async () => {
	const brand = await loadModule();
	assert.equal(brand.BRAND_NAME, 'SANTO DOMINGO SAVIO');
	assert.equal(brand.BRAND_SUBTITLE, 'Periódico Escolar Salesiano');
});

test('construye títulos de página consistentes con el nombre institucional', async () => {
	const { brandTitle } = await loadModule();
	assert.equal(typeof brandTitle, 'function');
	assert.equal(brandTitle?.(), 'Santo Domingo Savio · Periódico Escolar Salesiano');
	assert.equal(brandTitle?.('Inicio'), 'Inicio · Santo Domingo Savio');
});
