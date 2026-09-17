/** Isolated local smoke fixture. Never connects to a configured production database. */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const mongo = await MongoMemoryServer.create({
	binary: { downloadDir: resolve('.svelte-kit/smoke-mongo') },
	instance: { ip: '127.0.0.1' }
});
const client = new MongoClient(mongo.getUri());
await client.connect();
const db = client.db('rich_text_smoke');
const adminId = new ObjectId();
const userId = new ObjectId();
const categoryId = new ObjectId();
const richId = new ObjectId();
const legacyId = new ObjectId();
const pendingId = new ObjectId();
const now = new Date();
const adminToken = randomBytes(32).toString('hex');
const userToken = randomBytes(32).toString('hex');
await db.collection('users').insertMany([
	{
		_id: adminId,
		email: 'admin@salesianos.edu.do',
		username: 'smoke.admin',
		provider: 'credentials',
		role: 'superadmin',
		emailVerified: true,
		createdAt: now,
		trustedDomains: ['example.com']
	},
	{
		_id: userId,
		email: 'lector@salesianos.edu.do',
		username: 'smoke.lector',
		provider: 'credentials',
		role: 'user',
		emailVerified: true,
		createdAt: now
	}
]);
await db.collection('sessions').insertMany([
	{
		userId: adminId,
		tokenHash: createHash('sha256').update(adminToken).digest('hex'),
		createdAt: now,
		expiresAt: new Date(Date.now() + 3_600_000)
	},
	{
		userId,
		tokenHash: createHash('sha256').update(userToken).digest('hex'),
		createdAt: now,
		expiresAt: new Date(Date.now() + 3_600_000)
	}
]);
await db
	.collection('categories')
	.insertOne({ _id: categoryId, name: 'Noticias', slug: 'noticias', createdAt: now });
const contentRich = {
	version: 1,
	doc: {
		type: 'doc',
		content: [
			{
				type: 'heading',
				attrs: { level: 2 },
				content: [{ type: 'text', text: 'Una jornada para recordar' }]
			},
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: 'La comunidad ', marks: [{ type: 'bold' }] },
					{ type: 'text', text: 'celebra', marks: [{ type: 'italic' }] },
					{ type: 'text', text: ' nuevos aprendizajes.' }
				]
			},
			{
				type: 'blockquote',
				content: [
					{ type: 'paragraph', content: [{ type: 'text', text: 'Aprender también es compartir.' }] }
				]
			},
			{
				type: 'bulletList',
				content: [
					{
						type: 'listItem',
						content: [
							{ type: 'paragraph', content: [{ type: 'text', text: 'Lectura y colaboración' }] }
						]
					}
				]
			},
			{
				type: 'paragraph',
				content: [
					{
						type: 'text',
						text: 'Sitio confiable',
						marks: [{ type: 'link', attrs: { href: 'https://example.com/' } }]
					},
					{ type: 'text', text: ' · ' },
					{
						type: 'text',
						text: 'Sitio nuevo',
						marks: [{ type: 'link', attrs: { href: 'https://example.org/' } }]
					},
					{ type: 'text', text: ' · ' },
					{
						type: 'text',
						text: 'Dentro del periódico',
						marks: [{ type: 'link', attrs: { href: '/login' } }]
					}
				]
			}
		]
	}
};
const base = {
	excerpt: 'Una publicación de prueba local.',
	categoryId: categoryId.toHexString(),
	authorId: adminId.toHexString(),
	authorEmail: 'admin@salesianos.edu.do',
	authorUsername: 'smoke.admin',
	createdAt: now,
	views: 0,
	likes: [],
	savedBy: [adminId.toHexString()],
	media: [],
	attachments: []
};
await db.collection('articles').insertMany([
	{
		...base,
		_id: richId,
		title: 'Contenido con formato',
		content: 'Una jornada para recordar\nLa comunidad celebra nuevos aprendizajes.',
		contentRich,
		status: 'published',
		publishedAt: now
	},
	{
		...base,
		_id: legacyId,
		title: 'Publicación anterior',
		content: 'Primera línea\nSegunda línea\n<script>Esto es texto, no código ejecutable.</script>',
		status: 'published',
		publishedAt: now
	},
	{
		...base,
		_id: pendingId,
		title: 'Formato pendiente de revisión',
		content: 'Contenido pendiente',
		contentRich,
		status: 'pending'
	}
]);
const app = spawn(
	process.execPath,
	['node_modules/vite/bin/vite.js', 'dev', '--host', '127.0.0.1', '--port', '4175', '--strictPort'],
	{
		stdio: ['ignore', 'inherit', 'inherit'],
		env: {
			...process.env,
			MONGODB_URI: mongo.getUri(),
			MONGODB_DB: 'rich_text_smoke',
			ORIGIN: 'http://127.0.0.1:4175',
			GOOGLE_CLIENT_ID: '',
			GOOGLE_CLIENT_SECRET: '',
			CLOUDFLARE_API_TOKEN: '',
			CLOUDFLARE_ACCOUNT_ID: ''
		}
	}
);
console.log(
	JSON.stringify({
		url: 'http://127.0.0.1:4175',
		adminToken,
		userToken,
		richPost: richId.toHexString(),
		legacyPost: legacyId.toHexString(),
		pendingPost: pendingId.toHexString()
	})
);
console.log('Type stop and Enter to shut down the app and remove the temporary database.');
let stopping = false;
async function stop() {
	if (stopping) return;
	stopping = true;
	app.kill();
	await client.close();
	await mongo.stop();
	process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
app.on('exit', () => void stop());
process.stdin.setEncoding('utf8');
process.stdin.on('data', (value: string) => {
	if (value.trim() === 'stop') void stop();
});
