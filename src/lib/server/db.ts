import { MongoClient, type Db } from 'mongodb';
import { env } from '$env/dynamic/private';

let client: MongoClient | null = null;
let db: Db | null = null;

if (!env.MONGODB_URI) {
	console.warn('MONGODB_URI no está definida. Configúrala en tu entorno.');
}

export async function getDb(): Promise<Db> {
	const uri = env.MONGODB_URI;
	const dbName = env.MONGODB_DB ?? 'periodico_escolar';

	if (!uri) {
		throw new Error('MONGODB_URI no está definida');
	}

	if (db && client) return db;

	client = new MongoClient(uri);
	await client.connect();
	db = client.db(dbName);
	return db;
}
