import type { ObjectId } from 'mongodb';

declare global {
	namespace App {
		interface Locals {
			user: {
				_id: string;
				email: string;
				provider: 'credentials' | 'google';
				role: 'user' | 'admin' | 'superadmin';
			} | null;
		}
	}
}

export {};
