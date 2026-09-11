import assert from 'node:assert/strict';
import test from 'node:test';

type MagicLinkEmailModule = {
	buildMagicLinkEmail?: (
		magicUrl: string,
		logoContent: string
	) => {
		subject: string;
		html: string;
		text: string;
		attachments: Array<{
			filename: string;
			content: string;
			type: string;
			disposition: 'inline' | 'attachment';
			content_id?: string;
		}>;
	};
};

async function loadModule(): Promise<MagicLinkEmailModule> {
	return import('../src/lib/server/magicLinkEmail.ts').catch(() => ({}));
}

test('construye el correo de acceso con el isotipo inline sobre una cabecera blanca', async () => {
	const { buildMagicLinkEmail } = await loadModule();
	assert.equal(typeof buildMagicLinkEmail, 'function');

	const email = buildMagicLinkEmail?.(
		'https://periodico.example/auth/m/token-de-prueba',
		'iVBORw0KGgoAAAANSUhEUg=='
	);

	assert.equal(email?.subject, 'Tu enlace de acceso al Periódico Escolar Salesiano');
	assert.match(email?.html ?? '', /src="cid:periodico-sds-logo"/);
	assert.match(email?.html ?? '', /background:\s*#ffffff/);
	assert.match(email?.html ?? '', /https:\/\/periodico\.example\/auth\/m\/token-de-prueba/);
	assert.match(email?.text ?? '', /https:\/\/periodico\.example\/auth\/m\/token-de-prueba/);
	assert.deepEqual(email?.attachments, [
		{
			filename: 'isotipo-periodico-sds.png',
			content: 'iVBORw0KGgoAAAANSUhEUg==',
			type: 'image/png',
			disposition: 'inline',
			content_id: 'periodico-sds-logo'
		}
	]);
});
