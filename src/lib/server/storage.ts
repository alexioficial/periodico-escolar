import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '$env/dynamic/private';

// Tipos que nunca aceptamos: pueden ejecutar JS/HTML desde el dominio de S3
// (XSS contra el dominio del bucket) o son contenedores de scripts.
const DANGEROUS_MIMES: ReadonlySet<string> = new Set([
	'image/svg+xml',
	'text/html',
	'application/xhtml+xml',
	'application/xml',
	'text/xml',
	'application/javascript',
	'application/ecmascript',
	'text/javascript',
	'application/x-shockwave-flash',
	'application/x-mhtml',
	'message/rfc822'
]);

export interface SaveFileOptions {
	/**
	 * Si se pasa, exige que el MIME real detectado por magic bytes esté en esta lista.
	 * Para uploads de avatar pasale ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].
	 */
	allowedMimes?: readonly string[];
	/**
	 * Si true (default), exige que archivos declarados como image/* o video/*
	 * tengan magic bytes que lo confirmen.
	 */
	strictMediaSignature?: boolean;
	/**
	 * Tamaño máximo en bytes para este archivo. Si no se pasa, no se aplica
	 * límite (el caller es responsable de validar según el contexto/rol).
	 * Pasá `Infinity` explícitamente también desactiva el límite.
	 */
	maxFileSize?: number;
}

// Tope absoluto de tamaño (2 GB). Aunque el caller pase Infinity o no pase
// nada, refuerza protección contra OOM por cargar el File completo en memoria.
const ABSOLUTE_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora — alineado con la cache.
const SIGNED_URL_CACHE_BUFFER_MS = 5 * 60_000; // refrescamos 5 min antes de expirar
const SIGNED_URL_CACHE_MAX_ENTRIES = 5000;

interface CachedSignedUrl {
	url: string;
	expiresAt: number;
}

const signedUrlCache = new Map<string, CachedSignedUrl>();

let client: S3Client | null = null;

function getClient(): S3Client {
	if (client) return client;

	const region = env.AWS_S3_REGION;
	const accessKeyId = env.AWS_S3_ACCESS_KEY_ID;
	const secretAccessKey = env.AWS_S3_SECRET_ACCESS_KEY;

	if (!region || !accessKeyId || !secretAccessKey) {
		throw new Error(
			'S3 no está configurado. Define AWS_S3_REGION, AWS_S3_ACCESS_KEY_ID y AWS_S3_SECRET_ACCESS_KEY.'
		);
	}

	client = new S3Client({
		region,
		endpoint: env.AWS_S3_ENDPOINT || undefined,
		forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE === 'true',
		credentials: { accessKeyId, secretAccessKey }
	});

	return client;
}

function getBucket(): string {
	const bucket = env.AWS_S3_BUCKET;
	if (!bucket) throw new Error('AWS_S3_BUCKET no está definido');
	return bucket;
}

function sanitizeExtension(name: string) {
	const idx = name.lastIndexOf('.');
	// Sin punto en el nombre, no hay extensión que extraer (evita usar el
	// nombre entero como ext cuando el archivo no tiene una).
	if (idx < 0 || idx === name.length - 1) return '';
	const ext = name.slice(idx + 1);
	return ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// Para headers HTTP: aceptamos sólo ASCII imprimible y eliminamos comillas,
// backslash y caracteres de control (CR/LF) para evitar header injection.
function asciiFilename(name: string) {
	return name.replace(/[\x00-\x1f\x7f"\\]/g, '_').slice(0, 200) || 'archivo';
}

/**
 * Sube un archivo a S3. Devuelve el `key` interno (no la URL),
 * que es lo que se guarda en la base de datos.
 *
 * El MIME del cliente (`file.type`) es falsificable. Validamos el tipo real
 * leyendo magic bytes con `file-type` y bloqueamos formatos peligrosos
 * (SVG/HTML/XML/JS) que podrían ejecutar JS desde el dominio del bucket.
 */
export async function saveFile(file: File, options: SaveFileOptions = {}): Promise<string> {
	const { allowedMimes, strictMediaSignature = true, maxFileSize } = options;

	if (maxFileSize !== undefined && Number.isFinite(maxFileSize) && file.size > maxFileSize) {
		throw new Error(
			`El archivo ${file.name} es demasiado grande. Tamaño máximo: ${maxFileSize / 1024 / 1024} MB`
		);
	}
	if (file.size > ABSOLUTE_MAX_FILE_SIZE) {
		throw new Error(
			`El archivo ${file.name} excede el tope absoluto del servidor (${ABSOLUTE_MAX_FILE_SIZE / 1024 / 1024 / 1024} GB).`
		);
	}
	if (file.size === 0) {
		throw new Error('El archivo está vacío');
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const detected = await fileTypeFromBuffer(buffer);
	const detectedMime = detected?.mime;

	if (detectedMime && DANGEROUS_MIMES.has(detectedMime)) {
		throw new Error(`El tipo de archivo de "${file.name}" no es permitido.`);
	}

	const declaredMime = file.type;
	if (
		strictMediaSignature &&
		(declaredMime.startsWith('image/') || declaredMime.startsWith('video/')) &&
		!detectedMime
	) {
		throw new Error(`El archivo "${file.name}" no parece ser una imagen o video válidos.`);
	}

	if (allowedMimes && allowedMimes.length > 0) {
		if (!detectedMime || !allowedMimes.includes(detectedMime)) {
			throw new Error(`El tipo de archivo de "${file.name}" no es permitido.`);
		}
	}

	// Para el ContentType usamos el MIME detectado (no el del cliente). Para
	// archivos no-media forzamos `attachment` para que el navegador no los
	// renderice inline aunque alguien obtenga una URL firmada.
	const contentType = detectedMime ?? 'application/octet-stream';
	const isInlineSafe = contentType.startsWith('image/') || contentType.startsWith('video/');

	const ext = sanitizeExtension(file.name);
	const key = `uploads/${randomUUID()}${ext ? '.' + ext : ''}`;

	try {
		await getClient().send(
			new PutObjectCommand({
				Bucket: getBucket(),
				Key: key,
				Body: buffer,
				ContentType: contentType,
				...(isInlineSafe ? {} : { ContentDisposition: 'attachment' })
			})
		);
	} catch (error) {
		console.error('Error uploading file to S3:', error);
		throw new Error('Error al subir el archivo. Por favor intenta de nuevo.');
	}

	return key;
}

/**
 * Devuelve una URL firmada con TTL para visualización inline (img/video).
 * Cachea por `key` para no re-firmar en cada request (el hook lo necesita por
 * cada navegación).
 */
export async function getViewUrl(key: string, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
	const now = Date.now();
	const cached = signedUrlCache.get(key);
	if (cached && cached.expiresAt > now + SIGNED_URL_CACHE_BUFFER_MS) {
		return cached.url;
	}

	const url = await getSignedUrl(
		getClient(),
		new GetObjectCommand({
			Bucket: getBucket(),
			Key: key
		}),
		{ expiresIn }
	);

	if (signedUrlCache.size >= SIGNED_URL_CACHE_MAX_ENTRIES) {
		// LRU básico: borra la primera entrada (la más vieja por orden de inserción).
		const oldestKey = signedUrlCache.keys().next().value;
		if (oldestKey !== undefined) signedUrlCache.delete(oldestKey);
	}
	signedUrlCache.set(key, { url, expiresAt: now + expiresIn * 1000 });
	return url;
}

/**
 * Devuelve una URL firmada con TTL configurada para forzar descarga
 * con el nombre original del archivo.
 */
export async function getDownloadUrl(
	key: string,
	filename: string,
	expiresIn = SIGNED_URL_TTL_SECONDS
): Promise<string> {
	// Usamos RFC 5987 (filename*) para soportar caracteres no-ASCII de forma
	// segura, y un fallback ASCII estricto para el `filename=` clásico. Esto
	// también previene HTTP header injection si el filename trae CRLF.
	const ascii = asciiFilename(filename);
	const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) =>
		'%' + c.charCodeAt(0).toString(16).toUpperCase()
	);
	const disposition = `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;

	return getSignedUrl(
		getClient(),
		new GetObjectCommand({
			Bucket: getBucket(),
			Key: key,
			ResponseContentDisposition: disposition
		}),
		{ expiresIn }
	);
}

/**
 * Elimina un objeto. No lanza si no existe.
 */
export async function deleteFile(key: string): Promise<void> {
	signedUrlCache.delete(key);
	try {
		await getClient().send(
			new DeleteObjectCommand({
				Bucket: getBucket(),
				Key: key
			})
		);
	} catch (error) {
		console.error('Error deleting file from S3:', error);
	}
}
