import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = 'static/uploads';

export async function saveFile(file: File): Promise<string> {
    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = extname(file.name);
    const filename = `${randomUUID()}${extension}`;
    const filePath = join(UPLOAD_DIR, filename);

    await writeFile(filePath, buffer);

    return `/uploads/${filename}`;
}
