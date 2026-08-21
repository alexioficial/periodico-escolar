import {
	MongoClient,
	MongoServerError,
	type Db,
	type IndexDescriptionInfo,
	type ObjectId
} from 'mongodb';
import { env } from '$env/dynamic/private';
import crypto from 'crypto';

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

async function listIndexesOrEmpty(db: Db, collection: string): Promise<IndexDescriptionInfo[]> {
	try {
		return await db.collection(collection).indexes();
	} catch (error) {
		if (error instanceof MongoServerError && error.code === 26) return [];
		throw error;
	}
}

async function ensureCollatedUniqueIndex(
	db: Db,
	collection: string,
	field: string,
	options: { sparse?: boolean } = {}
) {
	const coll = db.collection(collection);
	// listIndexes falla con NamespaceNotFound en una base recién creada;
	// createIndex sí crea la colección, así que ese caso equivale a lista vacía.
	const indexes = await listIndexesOrEmpty(db, collection);
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

async function ensureUniqueIndex(
	db: Db,
	collection: string,
	field: string,
	options: { sparse?: boolean } = {}
) {
	const coll = db.collection(collection);
	const name = `${field}_1`;
	const existing = (await listIndexesOrEmpty(db, collection)).find((index) => index.name === name);
	const optionsMatch =
		existing?.unique === true &&
		(options.sparse === undefined || existing.sparse === options.sparse);
	if (existing && !optionsMatch) await coll.dropIndex(name);
	await coll.createIndex({ [field]: 1 }, { unique: true, ...options });
}

async function ensureIndexes(db: Db) {
	// users.email y users.username deben ser únicos case-insensitive para
	// que "Pepe" y "pepe" sean el mismo usuario. Si los índices viejos están
	// sin collation, los recreamos con collation.
	await ensureCollatedUniqueIndex(db, 'users', 'email');
	await ensureCollatedUniqueIndex(db, 'users', 'username', { sparse: true });
	await ensureCollatedUniqueIndex(db, 'categories', 'name');

	// Versiones previas permitían más de un magic-link por correo. Conservamos
	// sólo el más reciente antes de convertir email_1 en índice único.
	const magicTokens = db.collection('magic_login_tokens');
	const duplicateTokenEmails = await magicTokens
		.aggregate<{
			_id: string;
			ids: ObjectId[];
		}>([
			{ $sort: { createdAt: -1 } },
			{ $group: { _id: '$email', ids: { $push: '$_id' }, count: { $sum: 1 } } },
			{ $match: { count: { $gt: 1 } } }
		])
		.toArray();
	for (const duplicate of duplicateTokenEmails) {
		await magicTokens.deleteMany({ _id: { $in: duplicate.ids.slice(1) } });
	}

	await ensureUniqueIndex(db, 'users', 'googleId', { sparse: true });
	await ensureUniqueIndex(db, 'magic_login_tokens', 'email');

	const sessions = db.collection('sessions');
	const legacySessions = await sessions
		.find<{
			_id: ObjectId;
			token: string;
		}>({ token: { $type: 'string' } }, { projection: { token: 1 } })
		.toArray();
	if (legacySessions.length > 0) {
		await sessions.bulkWrite(
			legacySessions.map((session) => ({
				updateOne: {
					filter: { _id: session._id, token: session.token },
					update: {
						$set: {
							tokenHash: crypto.createHash('sha256').update(session.token).digest('hex')
						},
						$unset: { token: '' }
					}
				}
			}))
		);
	}
	await ensureUniqueIndex(db, 'sessions', 'tokenHash', { sparse: true });

	await Promise.all([
		db.collection('sessions').createIndex({ userId: 1 }),
		db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

		db.collection('magic_login_tokens').createIndex({ tokenHash: 1 }, { unique: true }),
		db.collection('magic_login_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

		db.collection('articles').createIndex({ status: 1, publishedAt: -1 }),
		db.collection('articles').createIndex({ authorId: 1, createdAt: -1 }),
		db.collection('articles').createIndex({ savedBy: 1 }),
		db.collection('articles').createIndex({ categoryId: 1 }),

		db.collection('categories').createIndex({ slug: 1 }, { unique: true }),

		db.collection('rate_limit_buckets').createIndex({ key: 1 }, { unique: true }),
		db.collection('rate_limit_buckets').createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 })
	]);
}

export async function getDb(): Promise<Db> {
	if (db && client && indexesPromise) {
		await indexesPromise;
		return db;
	}

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
				const connectedDb = c.db(dbName);
				indexesPromise = ensureIndexes(connectedDb);
				await indexesPromise;
				client = c;
				db = connectedDb;
				return connectedDb;
			} catch (error) {
				// No servimos tráfico sin los índices de integridad. Limpiamos el
				// estado para permitir un reintento real en la próxima solicitud.
				console.error('Error al conectar o preparar MongoDB:', error);
				connectPromise = null;
				indexesPromise = null;
				await c.close().catch(() => {});
				throw error;
			}
		})();
	}

	return connectPromise;
}
