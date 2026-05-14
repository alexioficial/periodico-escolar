import { MongoClient, type Db } from 'mongodb';
import { env } from '$env/dynamic/private';

let client: MongoClient | null = null;
let db: Db | null = null;
let indexesPromise: Promise<void> | null = null;
// Reusamos la promesa de conexión: sin esto, dos requests que entren
// antes de que `connect()` resuelva crean dos MongoClient en paralelo.
let connectPromise: Promise<Db> | null = null;

if (!env.MONGODB_URI) {
	console.warn('MONGODB_URI no está definida. Configúrala en tu entorno.');
}

const CI_COLLATION = { locale: 'en', strength: 2 };

async function ensureCollatedUniqueIndex(
	db: Db,
	collection: string,
	field: string,
	options: { sparse?: boolean } = {}
) {
	const coll = db.collection(collection);
	const indexes = await coll.indexes();
	const existing = indexes.find((i) => i.name === `${field}_1`);
	const collationOk =
		!!existing?.collation &&
		existing.collation.locale?.startsWith('en') &&
		existing.collation.strength === 2;

	if (existing && !collationOk) {
		await coll.dropIndex(`${field}_1`);
	}

	await coll.createIndex({ [field]: 1 }, { unique: true, collation: CI_COLLATION, ...options });
}

async function ensureIndexes(db: Db) {
	// users.email y users.username deben ser únicos case-insensitive para
	// que "Pepe" y "pepe" sean el mismo usuario. Si los índices viejos están
	// sin collation, los recreamos con collation.
	await ensureCollatedUniqueIndex(db, 'users', 'email');
	await ensureCollatedUniqueIndex(db, 'users', 'username', { sparse: true });

	await Promise.all([
		db.collection('users').createIndex({ provider: 1, googleId: 1 }, { sparse: true }),

		db.collection('sessions').createIndex({ token: 1 }, { unique: true }),
		db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

		db.collection('email_verification_codes').createIndex({ email: 1 }),
		db
			.collection('email_verification_codes')
			.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

		db.collection('password_reset_codes').createIndex({ email: 1 }),
		db.collection('password_reset_codes').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

		db.collection('articles').createIndex({ status: 1, publishedAt: -1 }),
		db.collection('articles').createIndex({ authorId: 1, createdAt: -1 }),
		db.collection('articles').createIndex({ savedBy: 1 }),
		db.collection('articles').createIndex({ categoryId: 1 }),

		db.collection('categories').createIndex({ slug: 1 }, { unique: true }),
		db.collection('categories').createIndex({ name: 1 }, { unique: true }),

		db.collection('rate_limit_buckets').createIndex({ key: 1 }, { unique: true }),
		db.collection('rate_limit_buckets').createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 })
	]);
}

export async function getDb(): Promise<Db> {
	if (db && client) return db;

	if (!connectPromise) {
		const uri = env.MONGODB_URI;
		const dbName = env.MONGODB_DB ?? 'periodico_escolar';
		if (!uri) {
			throw new Error('MONGODB_URI no está definida');
		}

		connectPromise = (async () => {
			const c = new MongoClient(uri, {
				serverSelectionTimeoutMS: 5_000,
				connectTimeoutMS: 10_000,
				socketTimeoutMS: 30_000
			});
			try {
				await c.connect();
			} catch (err) {
				// Permitimos reintento en la próxima llamada en vez de quedar
				// con una promesa rechazada cacheada para siempre.
				connectPromise = null;
				throw err;
			}
			client = c;
			db = c.db(dbName);

			if (!indexesPromise) {
				indexesPromise = ensureIndexes(db).catch((err) => {
					console.error('Error al crear índices:', err);
				});
			}

			return db;
		})();
	}

	return connectPromise;
}
