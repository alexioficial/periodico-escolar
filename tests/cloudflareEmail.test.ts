import assert from 'node:assert/strict';
import test from 'node:test';

type CloudflareEmailModule = {
	sendCloudflareEmail?: (
		config: {
			accountId: string;
			apiToken: string;
			fromAddress: string;
			fromName?: string;
		},
		message: {
			to: string;
			subject: string;
			html: string;
			text: string;
			attachments?: Array<{
				filename: string;
				content: string;
				type: string;
				disposition: 'inline' | 'attachment';
				content_id?: string;
			}>;
		},
		options?: {
			fetch?: typeof fetch;
			delay?: (milliseconds: number) => Promise<void>;
		}
	) => Promise<string>;
};

async function loadModule(): Promise<CloudflareEmailModule> {
	return import('../src/lib/server/cloudflareEmail.ts').catch(() => ({}));
}

const config = {
	accountId: '11111111111111111111111111111111',
	apiToken: 'test-api-token',
	fromAddress: 'no-reply@widube.com',
	fromName: 'Periódico escolar'
};

const message = {
	to: 'lector@example.com',
	subject: 'Tu enlace de acceso',
	html: '<p>Abre el enlace</p>',
	text: 'Abre el enlace'
};

test('envía el contrato completo al API REST de Cloudflare', async () => {
	const { sendCloudflareEmail } = await loadModule();
	assert.equal(typeof sendCloudflareEmail, 'function');

	let requestUrl = '';
	let requestInit: RequestInit | undefined;
	const fakeFetch: typeof fetch = async (input, init) => {
		requestUrl = String(input);
		requestInit = init;
		return Response.json({
			success: true,
			errors: [],
			messages: [],
			result: {
				delivered: ['lector@example.com'],
				queued: [],
				permanent_bounces: [],
				suppressed_recipients: [],
				message_id: '<message-id@widube.com>'
			}
		});
	};

	const messageId = await sendCloudflareEmail?.(config, message, { fetch: fakeFetch });

	assert.equal(
		requestUrl,
		'https://api.cloudflare.com/client/v4/accounts/11111111111111111111111111111111/email/sending/send'
	);
	assert.equal(requestInit?.method, 'POST');
	assert.deepEqual(requestInit?.headers, {
		Authorization: 'Bearer test-api-token',
		'Content-Type': 'application/json'
	});
	assert.deepEqual(JSON.parse(String(requestInit?.body)), {
		from: { address: 'no-reply@widube.com', name: 'Periódico escolar' },
		to: 'lector@example.com',
		subject: 'Tu enlace de acceso',
		html: '<p>Abre el enlace</p>',
		text: 'Abre el enlace'
	});
	assert.equal(messageId, '<message-id@widube.com>');
});

test('incluye un logo inline en el payload enviado a Cloudflare', async () => {
	const { sendCloudflareEmail } = await loadModule();
	assert.equal(typeof sendCloudflareEmail, 'function');

	let requestInit: RequestInit | undefined;
	const fakeFetch: typeof fetch = async (_input, init) => {
		requestInit = init;
		return Response.json({
			success: true,
			errors: [],
			messages: [],
			result: {
				delivered: ['lector@example.com'],
				queued: [],
				permanent_bounces: [],
				suppressed_recipients: [],
				message_id: '<inline-logo@widube.com>'
			}
		});
	};
	const attachments = [
		{
			filename: 'isotipo-periodico-sds.png',
			content: 'iVBORw0KGgoAAAANSUhEUg==',
			type: 'image/png',
			disposition: 'inline' as const,
			content_id: 'periodico-sds-logo'
		}
	];

	await sendCloudflareEmail?.(config, { ...message, attachments }, { fetch: fakeFetch });

	assert.deepEqual(JSON.parse(String(requestInit?.body)).attachments, attachments);
});

test('acepta como exitoso un correo encolado', async () => {
	const { sendCloudflareEmail } = await loadModule();
	assert.equal(typeof sendCloudflareEmail, 'function');

	const fakeFetch: typeof fetch = async () =>
		Response.json({
			success: true,
			errors: [],
			messages: [],
			result: {
				delivered: [],
				queued: ['lector@example.com'],
				permanent_bounces: [],
				suppressed_recipients: [],
				message_id: '<queued@widube.com>'
			}
		});

	assert.equal(
		await sendCloudflareEmail?.(config, message, { fetch: fakeFetch }),
		'<queued@widube.com>'
	);
});

test('limita el tiempo de cada solicitud a Cloudflare', async () => {
	const { sendCloudflareEmail } = await loadModule();
	assert.equal(typeof sendCloudflareEmail, 'function');

	let requestSignal: AbortSignal | null | undefined;
	const fakeFetch: typeof fetch = async (_input, init) => {
		requestSignal = init?.signal;
		return Response.json({
			success: true,
			errors: [],
			messages: [],
			result: {
				delivered: ['lector@example.com'],
				queued: [],
				permanent_bounces: [],
				suppressed_recipients: [],
				message_id: '<timeout@widube.com>'
			}
		});
	};

	await sendCloudflareEmail?.(config, message, { fetch: fakeFetch });
	assert.equal(requestSignal instanceof AbortSignal, true);
});

test('reintenta respuestas temporales pero no errores permanentes', async () => {
	const { sendCloudflareEmail } = await loadModule();
	assert.equal(typeof sendCloudflareEmail, 'function');

	let transientAttempts = 0;
	const delays: number[] = [];
	const transientFetch: typeof fetch = async () => {
		transientAttempts += 1;
		if (transientAttempts < 3) return new Response(null, { status: 503 });
		return Response.json({
			success: true,
			errors: [],
			messages: [],
			result: {
				delivered: ['lector@example.com'],
				queued: [],
				permanent_bounces: [],
				suppressed_recipients: [],
				message_id: '<retried@widube.com>'
			}
		});
	};

	assert.equal(
		await sendCloudflareEmail?.(config, message, {
			fetch: transientFetch,
			delay: async (milliseconds) => {
				delays.push(milliseconds);
			}
		}),
		'<retried@widube.com>'
	);
	assert.equal(transientAttempts, 3);
	assert.deepEqual(delays, [250, 500]);

	let rateLimitAttempts = 0;
	const rateLimitFetch: typeof fetch = async () => {
		rateLimitAttempts += 1;
		if (rateLimitAttempts === 1) return new Response(null, { status: 429 });
		return Response.json({
			success: true,
			errors: [],
			messages: [],
			result: {
				delivered: ['lector@example.com'],
				queued: [],
				permanent_bounces: [],
				suppressed_recipients: [],
				message_id: '<rate-limit@widube.com>'
			}
		});
	};
	assert.equal(
		await sendCloudflareEmail?.(config, message, {
			fetch: rateLimitFetch,
			delay: async () => undefined
		}),
		'<rate-limit@widube.com>'
	);
	assert.equal(rateLimitAttempts, 2);

	let permanentAttempts = 0;
	const permanentFetch: typeof fetch = async () => {
		permanentAttempts += 1;
		return new Response(null, { status: 401 });
	};
	await assert.rejects(
		async () => sendCloudflareEmail?.(config, message, { fetch: permanentFetch }),
		/HTTP 401/
	);
	assert.equal(permanentAttempts, 1);
});

test('rechaza rebotes, supresiones y respuestas exitosas malformadas', async () => {
	const { sendCloudflareEmail } = await loadModule();
	assert.equal(typeof sendCloudflareEmail, 'function');

	for (const result of [
		{
			delivered: [],
			queued: [],
			permanent_bounces: ['lector@example.com'],
			suppressed_recipients: [],
			message_id: '<bounce@widube.com>'
		},
		{
			delivered: [],
			queued: [],
			permanent_bounces: [],
			suppressed_recipients: ['lector@example.com'],
			message_id: '<suppressed@widube.com>'
		},
		{
			delivered: [],
			queued: [],
			permanent_bounces: [],
			suppressed_recipients: [],
			message_id: '<unknown@widube.com>'
		}
	]) {
		const fakeFetch: typeof fetch = async () =>
			Response.json({ success: true, errors: [], messages: [], result });
		await assert.rejects(
			async () => sendCloudflareEmail?.(config, message, { fetch: fakeFetch }),
			/Cloudflare no confirmó el envío del correo/
		);
	}
});

test('rechaza una configuración incompleta antes de llamar a la red', async () => {
	const { sendCloudflareEmail } = await loadModule();
	assert.equal(typeof sendCloudflareEmail, 'function');

	let networkCalled = false;
	const fakeFetch: typeof fetch = async () => {
		networkCalled = true;
		return new Response();
	};

	await assert.rejects(
		async () => sendCloudflareEmail?.({ ...config, apiToken: '' }, message, { fetch: fakeFetch }),
		/Cloudflare Email Sending no está configurado correctamente/
	);
	assert.equal(networkCalled, false);
});
