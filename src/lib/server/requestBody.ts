export class LimitedJsonBodyError extends Error {
	constructor(
		public readonly status: 400 | 413 | 415,
		message: string
	) {
		super(message);
		this.name = 'LimitedJsonBodyError';
	}
}

export async function readLimitedJsonBody(request: Request, maxBytes: number): Promise<unknown> {
	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (contentType !== 'application/json') {
		throw new LimitedJsonBodyError(415, 'Se requiere Content-Type application/json');
	}

	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
		throw new LimitedJsonBodyError(413, 'Cuerpo JSON demasiado grande');
	}

	const reader = request.body?.getReader();
	if (!reader) throw new LimitedJsonBodyError(400, 'Cuerpo JSON inválido');

	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		totalBytes += value.byteLength;
		if (totalBytes > maxBytes) {
			await reader.cancel().catch(() => undefined);
			throw new LimitedJsonBodyError(413, 'Cuerpo JSON demasiado grande');
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw new LimitedJsonBodyError(400, 'Cuerpo JSON inválido');
	}
}
