import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/core/providers/google';
import { env } from '$env/dynamic/private';
import { findOrCreateUserFromGoogle } from '$lib/server/auth';

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [
		Google({
			clientId: env.GOOGLE_CLIENT_ID!,
			clientSecret: env.GOOGLE_CLIENT_SECRET!
		})
	],
	callbacks: {
		async signIn({ account, profile }) {
			if (account?.provider === 'google' && profile && 'sub' in profile && 'email' in profile) {
				await findOrCreateUserFromGoogle({
					sub: String(profile.sub),
					email: String(profile.email),
					name: 'name' in profile && profile.name ? String(profile.name) : undefined,
					picture: 'picture' in profile && profile.picture ? String(profile.picture) : undefined,
					email_verified:
						'email_verified' in profile && typeof profile.email_verified === 'boolean'
							? profile.email_verified
							: undefined
				});
			}
			return true;
		}
	}
});
