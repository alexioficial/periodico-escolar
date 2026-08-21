import { fail, redirect } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import type { Actions, PageServerLoad } from './$types';
import {
	getUserById,
	updateUserProfile,
	UsernameTakenError,
	USERNAME_REGEX
} from '$lib/server/auth';
import { saveFile, deleteFile, getViewUrl } from '$lib/server/storage';
import { loginPath } from '$lib/server/redirect';

const MAX_AVATAR_MB = 4.5;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, loginPath(`${url.pathname}${url.search}`));
	}

	const fullUser = await getUserById(new ObjectId(locals.user._id));
	if (!fullUser) {
		throw redirect(303, loginPath(`${url.pathname}${url.search}`));
	}

	let pictureUrl: string | undefined;
	if (fullUser.picture) {
		if (/^https?:\/\//i.test(fullUser.picture)) {
			pictureUrl = fullUser.picture;
		} else {
			try {
				pictureUrl = await getViewUrl(fullUser.picture);
			} catch (error) {
				console.error('Error al firmar URL de avatar:', error);
			}
		}
	}

	return {
		profile: {
			email: fullUser.email,
			username: fullUser.username ?? '',
			name: fullUser.name ?? '',
			pictureUrl,
			provider: fullUser.provider,
			emailVerified: fullUser.emailVerified === true
		}
	};
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'No autorizado' });

		const formData = await request.formData();
		const usernameRaw = String(formData.get('username') ?? '').trim();
		const nameRaw = String(formData.get('name') ?? '').trim();
		const removePicture = formData.get('removePicture') === 'on';
		const pictureFile = formData.get('picture');

		if (!usernameRaw) {
			return fail(400, { message: 'El nombre de usuario es obligatorio' });
		}
		if (!USERNAME_REGEX.test(usernameRaw)) {
			return fail(400, {
				message:
					'El nombre de usuario debe tener 3-20 caracteres y solo letras, números, ".", "_" o "-".'
			});
		}

		const userId = new ObjectId(locals.user._id);

		let newPictureKey: string | null | undefined;
		let uploadedKeyForRollback: string | null = null;

		const file = pictureFile instanceof File && pictureFile.size > 0 ? pictureFile : null;

		if (file) {
			if (!file.type.startsWith('image/')) {
				return fail(400, { message: 'La foto de perfil debe ser una imagen' });
			}
			if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
				return fail(400, { message: `La imagen supera el máximo de ${MAX_AVATAR_MB} MB` });
			}
			try {
				newPictureKey = await saveFile(file, {
					allowedMimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
					maxFileSize: MAX_AVATAR_MB * 1024 * 1024
				});
				uploadedKeyForRollback = newPictureKey;
			} catch (error) {
				console.error('Error al subir avatar:', error);
				const msg =
					error instanceof Error ? error.message : 'No se pudo subir la foto. Intenta de nuevo.';
				return fail(400, { message: msg });
			}
		} else if (removePicture) {
			newPictureKey = null;
		}

		let previous;
		try {
			previous = await updateUserProfile(userId, {
				username: usernameRaw,
				name: nameRaw === '' ? null : nameRaw,
				...(newPictureKey !== undefined ? { picture: newPictureKey } : {})
			});
		} catch (error) {
			if (uploadedKeyForRollback) {
				await deleteFile(uploadedKeyForRollback).catch(() => {});
			}
			if (error instanceof UsernameTakenError) {
				return fail(400, { message: error.message });
			}
			if (error instanceof Error) {
				return fail(400, { message: error.message });
			}
			console.error('Error al actualizar perfil:', error);
			return fail(500, { message: 'Error al actualizar el perfil' });
		}

		if (!previous) {
			if (uploadedKeyForRollback) {
				await deleteFile(uploadedKeyForRollback).catch(() => {});
			}
			return fail(404, { message: 'Usuario no encontrado' });
		}

		// Borramos la foto anterior basándonos en el documento previo retornado
		// por findOneAndUpdate (no por una lectura previa), así dos updates
		// concurrentes no dejan archivos huérfanos.
		if (
			newPictureKey !== undefined &&
			previous.picture &&
			previous.picture !== newPictureKey &&
			!/^https?:\/\//i.test(previous.picture)
		) {
			await deleteFile(previous.picture).catch(() => {});
		}

		return { success: true };
	}
};
