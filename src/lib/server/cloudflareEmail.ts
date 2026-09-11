export interface CloudflareEmailConfig {
	accountId: string;
	apiToken: string;
	fromAddress: string;
	fromName?: string;
}

export interface EmailMessage {
	to: string;
	subject: string;
	html: string;
	text: string;
}

interface SendOptions {
	fetch?: typeof fetch;
	delay?: (milliseconds: number) => Promise<void>;
}

interface CloudflareEmailResult {
	delivered?: string[];
	queued?: string[];
	permanent_bounces?: string[];
	suppressed_recipients?: string[];
	message_id?: string;
}

interface CloudflareEmailResponse {
	success?: boolean;
	result?: CloudflareEmailResult;
}

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isConfigured(config: CloudflareEmailConfig): boolean {
	return Boolean(config.accountId.trim() && config.apiToken.trim() && config.fromAddress.trim());
}

function isTransientStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

function confirmedDelivery(
	result: CloudflareEmailResult | undefined
): result is CloudflareEmailResult {
	if (!result) return false;
	if ((result.permanent_bounces?.length ?? 0) > 0) return false;
	if ((result.suppressed_recipients?.length ?? 0) > 0) return false;
	return (result.delivered?.length ?? 0) > 0 || (result.queued?.length ?? 0) > 0;
}

export async function sendCloudflareEmail(
	config: CloudflareEmailConfig,
	message: EmailMessage,
	options: SendOptions = {}
): Promise<string> {
	if (!isConfigured(config)) {
		throw new Error('Cloudflare Email Sending no está configurado correctamente');
	}

	const fetchRequest = options.fetch ?? fetch;
	const delay = options.delay ?? wait;
	const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId.trim())}/email/sending/send`;
	const body = {
		from: config.fromName?.trim()
			? { address: config.fromAddress.trim(), name: config.fromName.trim() }
			: config.fromAddress.trim(),
		to: message.to,
		subject: message.subject,
		html: message.html,
		text: message.text
	};

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		let response: Response;
		try {
			response = await fetchRequest(endpoint, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${config.apiToken.trim()}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch {
			if (attempt === MAX_ATTEMPTS) {
				throw new Error('No fue posible contactar Cloudflare Email Sending');
			}
			await delay(250 * 2 ** (attempt - 1));
			continue;
		}

		if (!response.ok) {
			if (isTransientStatus(response.status) && attempt < MAX_ATTEMPTS) {
				await delay(250 * 2 ** (attempt - 1));
				continue;
			}
			throw new Error(`Cloudflare no pudo enviar el correo (HTTP ${response.status})`);
		}

		let payload: CloudflareEmailResponse;
		try {
			payload = (await response.json()) as CloudflareEmailResponse;
		} catch {
			throw new Error('Cloudflare devolvió una respuesta de correo inválida');
		}

		if (
			payload.success !== true ||
			!confirmedDelivery(payload.result) ||
			!payload.result.message_id
		) {
			throw new Error('Cloudflare no confirmó el envío del correo');
		}

		return payload.result.message_id;
	}

	throw new Error('No fue posible enviar el correo');
}
