import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { env } from '$env/dynamic/private';

const DEFAULT_MAX_FILE_SIZE_MB = 10;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días (máximo permitido por SigV4 con IAM user)

function getMaxFileSize() {
	const mb = Number(env.MAX_FILE_SIZE_MB) || DEFAULT_MAX_FILE_SIZE_MB;
	return mb * 1024 * 1024;
}

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
	const ext = name.split('.').pop() ?? '';
	return ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Sube un archivo a S3. Devuelve el `key` interno (no la URL),
 * que es lo que se guarda en la base de datos.
 */
export async function saveFile(file: File): Promise<string> {
	const maxFileSize = getMaxFileSize();
	if (file.size > maxFileSize) {
		throw new Error(
			`El archivo ${file.name} es demasiado grande. Tamaño máximo: ${maxFileSize / 1024 / 1024} MB`
		);
	}
	if (file.size === 0) {
		throw new Error('El archivo está vacío');
	}

	const ext = sanitizeExtension(file.name);
	const key = `uploads/${randomUUID()}${ext ? '.' + ext : ''}`;
	const buffer = Buffer.from(await file.arrayBuffer());

	try {
		await getClient().send(
			new PutObjectCommand({
				Bucket: getBucket(),
				Key: key,
				Body: buffer,
				ContentType: file.type || 'application/octet-stream'
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
 */
export async function getViewUrl(key: string, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
	return getSignedUrl(
		getClient(),
		new GetObjectCommand({
			Bucket: getBucket(),
			Key: key
		}),
		{ expiresIn }
	);
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
	const safeFilename = filename.replace(/["\\]/g, '');
	return getSignedUrl(
		getClient(),
		new GetObjectCommand({
			Bucket: getBucket(),
			Key: key,
			ResponseContentDisposition: `attachment; filename="${safeFilename}"`
		}),
		{ expiresIn }
	);
}

/**
 * Elimina un objeto. No lanza si no existe.
 */
export async function deleteFile(key: string): Promise<void> {
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
