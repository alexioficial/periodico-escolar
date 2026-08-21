import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createArticle,
	getArticlesByAuthor,
	TITLE_MAX,
	EXCERPT_MAX,
	CONTENT_MAX,
	type ArticleMedia,
	type ArticleAttachment
} from '$lib/server/articles';
import { getCategories, ensureDefaultCategories, getCategoryById } from '$lib/server/categories';
import { saveFile, deleteFile } from '$lib/server/storage';
import { serialize } from '$lib/server/serialize';
import { getDb } from '$lib/server/db';
import { ObjectId } from 'mongodb';
import { checkRateLimit } from '$lib/server/rateLimit';

const ALLOWED_ATTACHMENT_MIMES = new Set([
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const ALLOWED_ATTACHMENT_EXTS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']);

function extOf(name: string) {
	return name.split('.').pop()?.toLowerCase() ?? '';
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	await ensureDefaultCategories();

	const [articles, categories] = await Promise.all([
		getArticlesByAuthor(locals.user._id),
		getCategories()
	]);

	const categoryMap = new Map(categories.map((c) => [c._id!.toString(), c.name]));
	const enrichedArticles = articles.map((a) => ({
		...a,
		category: categoryMap.get(a.categoryId) ?? 'Sin categoría'
	}));

	return {
		user: locals.user,
		articles: serialize(enrichedArticles),
		categories: serialize(categories)
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'No autorizado' });
		}

		const articleLimit = ['admin', 'superadmin'].includes(locals.user.role) ? 60 : 10;
		const rateLimit = await checkRateLimit({
			key: `article-create:${locals.user._id}`,
			limit: articleLimit,
			windowMs: 60 * 60_000,
			onError: 'closed'
		});
		if (!rateLimit.ok) {
			return fail(429, {
				message: `Has alcanzado el límite de publicaciones. Intenta de nuevo en ${rateLimit.retryAfter}s.`
			});
		}

		// Email no verificado no debería poder publicar, ni siquiera quedar en
		// cola: evita spam de pendientes desde cuentas falsas.
		const db = await getDb();
		const userDoc = await db.collection('users').findOne({ _id: new ObjectId(locals.user._id) });
		if (!userDoc) {
			return fail(401, { message: 'Sesión inválida. Vuelve a iniciar sesión.' });
		}
		if (userDoc.provider === 'credentials' && userDoc.emailVerified !== true) {
			return fail(403, {
				message: 'Verifica tu correo antes de publicar artículos.'
			});
		}

		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();
		const content = (formData.get('content') as string)?.trim();
		const categoryId = (formData.get('categoryId') as string)?.trim();
		const excerpt = (formData.get('excerpt') as string)?.trim();

		if (!title || !content || !categoryId || !excerpt) {
			return fail(400, { message: 'Faltan campos requeridos' });
		}

		if (title.length > TITLE_MAX) {
			return fail(400, { message: `El título no puede superar los ${TITLE_MAX} caracteres` });
		}
		if (excerpt.length > EXCERPT_MAX) {
			return fail(400, { message: `El extracto no puede superar los ${EXCERPT_MAX} caracteres` });
		}
		if (content.length > CONTENT_MAX) {
			return fail(400, { message: `El contenido no puede superar los ${CONTENT_MAX} caracteres` });
		}

		try {
			const category = await getCategoryById(categoryId);
			if (!category) {
				return fail(400, { message: 'La categoría seleccionada no existe' });
			}
		} catch {
			return fail(400, { message: 'La categoría seleccionada no es válida' });
		}

		const isSuperadmin = locals.user.role === 'superadmin';
		const isStaff = ['admin', 'superadmin'].includes(locals.user.role);
		const limits = {
			images: isStaff ? Infinity : 10,
			videos: isStaff ? Infinity : 2,
			attachments: isStaff ? Infinity : 3
		};
		const maxFileSizeMb = isSuperadmin ? Infinity : isStaff ? 150 : 50;
		const maxFileSizeBytes = Number.isFinite(maxFileSizeMb)
			? maxFileSizeMb * 1024 * 1024
			: Infinity;

		const mediaFiles = (formData.getAll('media') as File[]).filter(
			(f) => f.size > 0 && f.name !== 'undefined'
		);
		let imageCount = 0;
		let videoCount = 0;
		for (const file of mediaFiles) {
			const isImage = file.type.startsWith('image/');
			const isVideo = file.type.startsWith('video/');
			if (!isImage && !isVideo) {
				return fail(400, { message: `Tipo no permitido en multimedia: ${file.name}` });
			}
			if (isImage) imageCount++;
			if (isVideo) videoCount++;
		}
		if (imageCount > limits.images) {
			return fail(400, { message: `Máximo ${limits.images} imágenes permitidas` });
		}
		if (videoCount > limits.videos) {
			return fail(400, { message: `Máximo ${limits.videos} videos permitidos` });
		}

		const attachmentFiles = (formData.getAll('attachments') as File[]).filter(
			(f) => f.size > 0 && f.name !== 'undefined'
		);
		if (attachmentFiles.length > limits.attachments) {
			return fail(400, { message: `Máximo ${limits.attachments} adjuntos permitidos` });
		}
		for (const file of attachmentFiles) {
			const okMime = ALLOWED_ATTACHMENT_MIMES.has(file.type);
			const okExt = ALLOWED_ATTACHMENT_EXTS.has(extOf(file.name));
			if (!okMime && !okExt) {
				return fail(400, { message: `Tipo de adjunto no permitido: ${file.name}` });
			}
		}

		if (Number.isFinite(maxFileSizeBytes)) {
			for (const file of [...mediaFiles, ...attachmentFiles]) {
				if (file.size > maxFileSizeBytes) {
					return fail(400, {
						message: `El archivo "${file.name}" supera el límite de ${maxFileSizeMb} MB`
					});
				}
			}
		}

		const media: ArticleMedia[] = [];
		const attachments: ArticleAttachment[] = [];
		const uploadedKeys: string[] = [];

		try {
			for (const file of mediaFiles) {
				const key = await saveFile(file, { maxFileSize: maxFileSizeBytes });
				uploadedKeys.push(key);
				const type = file.type.startsWith('video/') ? 'video' : 'image';
				media.push({ type, key, mimeType: file.type });
			}
			for (const file of attachmentFiles) {
				const key = await saveFile(file, { maxFileSize: maxFileSizeBytes });
				uploadedKeys.push(key);
				attachments.push({
					name: file.name,
					key,
					size: file.size,
					mimeType: file.type
				});
			}
		} catch (error) {
			console.error(error);
			// Rollback: borrar los archivos subidos exitosamente antes del fallo
			await Promise.all(uploadedKeys.map((k) => deleteFile(k)));
			return fail(400, {
				message: error instanceof Error ? error.message : 'Error al subir archivos'
			});
		}

		const status = isStaff ? 'published' : 'pending';

		try {
			await createArticle({
				title,
				content,
				categoryId,
				excerpt,
				authorId: locals.user._id,
				authorEmail: locals.user.email,
				authorUsername: locals.user.username ?? locals.user.name ?? undefined,
				status,
				publishedAt: status === 'published' ? new Date() : undefined,
				media,
				attachments
			});

			return { success: true };
		} catch (error) {
			console.error(error);
			// Si falló la inserción en DB, borrar archivos subidos para no dejar huérfanos
			await Promise.all(uploadedKeys.map((k) => deleteFile(k)));
			return fail(500, { message: 'Error al crear el artículo' });
		}
	}
};
