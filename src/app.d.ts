// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { ObjectId } from 'mongodb';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				_id: string;
				email: string;
				provider: 'credentials' | 'google';
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
