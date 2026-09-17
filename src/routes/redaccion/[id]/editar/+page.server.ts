import { redirect, error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loginPath } from '$lib/server/redirect';
import { ownArticleDependencies } from '$lib/server/ownArticleDependencies';
import { getOwnArticle } from '$lib/server/ownArticleManagement';
import { handleOwnArticleMutation } from '$lib/server/ownArticleRequest';
import {
	toArticleContentPresentation,
	parseSubmittedArticleContent
} from '$lib/server/articleRichText';
import { serialize } from '$lib/server/serialize';
import { getCategories } from '$lib/server/categories';
import { ObjectId } from 'mongodb';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) throw redirect(303, loginPath(`${url.pathname}${url.search}`));
	const deps = await ownArticleDependencies();
	const account = /^[a-f\d]{24}$/i.test(locals.user._id)
		? await deps.users.findOne({ _id: new ObjectId(locals.user._id) })
		: null;
	if (!account) throw error(401, 'Sesión inválida. Vuelve a iniciar sesión.');
	if (account.provider === 'credentials' && account.emailVerified !== true)
		throw error(403, 'Verifica tu correo antes de modificar artículos.');
	const article = await getOwnArticle(deps.articles, params.id, locals.user._id);
	if (!article) throw error(404, 'Artículo no encontrado');
	const categories = await getCategories();
	return {
		article: serialize({ ...toArticleContentPresentation(article), _id: article._id.toString() }),
		categories: categories.map((category) => ({
			_id: category._id.toString(),
			name: category.name
		})),
		isStaff: account.role === 'admin' || account.role === 'superadmin'
	};
};

export const actions: Actions = {
	edit: async ({ locals, params, request }) => {
		if (!locals.user) return fail(401, { message: 'No autorizado', draft: undefined });
		let result;
		try {
			result = await handleOwnArticleMutation(
				request,
				locals.user,
				params.id,
				'edit',
				await ownArticleDependencies()
			);
		} catch (error) {
			console.error(error);
			return fail(500, {
				message: 'No se pudieron guardar los cambios. Intenta de nuevo.',
				draft: undefined
			});
		}
		if (result.status !== 200) {
			// For non-JS submissions retain an escaped/safe presentation, never raw rich JSON.
			let draft;
			if (result.draft) {
				let content = result.draft.content;
				let contentHtml = '';
				try {
					const safe = parseSubmittedArticleContent(content, result.draft.contentRich);
					content = safe.content;
					contentHtml = toArticleContentPresentation(safe).contentHtml;
				} catch {
					/* Invalid rich JSON falls back to literal plain text. */
				}
				draft = {
					title: result.draft.title,
					excerpt: result.draft.excerpt,
					categoryId: result.draft.categoryId,
					content,
					contentHtml
				};
			}
			return fail(result.status, { message: result.message, draft });
		}
		throw redirect(303, '/redaccion');
	}
};
