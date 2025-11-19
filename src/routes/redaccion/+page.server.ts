import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createArticle, getArticlesByAuthor } from '$lib/server/articles';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	const articles = await getArticlesByAuthor(locals.user._id);

	return {
		user: locals.user,
		articles: JSON.parse(JSON.stringify(articles)) // Serialize ObjectIds
	};
};

import { saveFile } from '$lib/server/storage';

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'No autorizado' });
		}

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const content = formData.get('content') as string;
		const category = formData.get('category') as string;
		const excerpt = formData.get('excerpt') as string;

		// Handle Media Files
		const mediaFiles = formData.getAll('media') as File[];
		const media = [];
		for (const file of mediaFiles) {
			if (file.size > 0 && file.name !== 'undefined') {
				const url = await saveFile(file);
				const type = file.type.startsWith('video/') ? 'video' : 'image';
				media.push({ type, url, mimeType: file.type });
			}
		}

		// Handle Attachments
		const attachmentFiles = formData.getAll('attachments') as File[];
		const attachments = [];
		for (const file of attachmentFiles) {
			if (file.size > 0 && file.name !== 'undefined') {
				const url = await saveFile(file);
				attachments.push({
					name: file.name,
					url,
					size: file.size,
					mimeType: file.type
				});
			}
		}

		if (!title || !content || !category || !excerpt) {
			return fail(400, { message: 'Faltan campos requeridos' });
		}

		// Admins and SuperAdmins publish immediately, Users go to pending
		const status = ['admin', 'superadmin'].includes(locals.user.role) ? 'published' : 'pending';

		try {
			await createArticle({
				title,
				content,
				category,
				excerpt,
				authorId: locals.user._id,
				authorEmail: locals.user.email,
				status,
				publishedAt: status === 'published' ? new Date() : undefined,
				media: media as any,
				attachments
			});

			return { success: true };
		} catch (error) {
			console.error(error);
			return fail(500, { message: 'Error al crear el artículo' });
		}
	}
};
