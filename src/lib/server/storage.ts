import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { env } from '$env/dynamic/private';

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

export async function saveFile(file: File): Promise<string> {
	if (file.size > MAX_FILE_SIZE) {
		throw new Error(`El archivo ${file.name} es demasiado grande. Tamaño máximo: 4.5 MB`);
	}

	if (file.size === 0) {
		throw new Error('El archivo está vacío');
	}

	try {
		const extension = file.name.split('.').pop() || '';
		const filename = `${randomUUID()}.${extension}`;

		const blob = await put(filename, file, {
			access: 'public',
			contentType: file.type || 'application/octet-stream',
			token: env.BLOB_READ_WRITE_TOKEN
		});

		return blob.url;
	} catch (error) {
		console.error('Error uploading file to Vercel Blob:', error);
		throw new Error('Error al subir el archivo. Por favor intenta de nuevo.');
	}
}
