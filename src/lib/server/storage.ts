import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { env } from '$env/dynamic/private';

// Maximum file size: 4.5 MB (Vercel Blob limit for Hobby plan)
const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB in bytes

export async function saveFile(file: File): Promise<string> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(
            `El archivo ${file.name} es demasiado grande. Tamaño máximo: 4.5 MB`
        );
    }

    // Validate that file exists and has content
    if (file.size === 0) {
        throw new Error('El archivo está vacío');
    }

    try {
        // Generate unique filename preserving extension
        const extension = file.name.split('.').pop() || '';
        const filename = `${randomUUID()}.${extension}`;

        // Upload to Vercel Blob
        const blob = await put(filename, file, {
            access: 'public',
            contentType: file.type || 'application/octet-stream',
            token: env.BLOB_READ_WRITE_TOKEN
        });

        // Return the public URL
        return blob.url;
    } catch (error) {
        console.error('Error uploading file to Vercel Blob:', error);
        throw new Error('Error al subir el archivo. Por favor intenta de nuevo.');
    }
}
