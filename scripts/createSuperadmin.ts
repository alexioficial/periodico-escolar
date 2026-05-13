import 'dotenv/config';
import { MongoClient } from 'mongodb';
import argon2 from 'argon2';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const TARGET_EMAIL = 'grullonmatiasalexi@gmail.com';

async function main() {
	const uri = process.env.MONGODB_URI;
	const dbName = process.env.MONGODB_DB ?? 'periodico_escolar';

	if (!uri) {
		console.error('✗ MONGODB_URI no está definida en .env');
		process.exit(1);
	}

	const client = new MongoClient(uri);
	await client.connect();
	const db = client.db(dbName);
	const users = db.collection('users');

	const existing = await users.findOne({ email: TARGET_EMAIL });

	if (existing) {
		if (existing.role === 'superadmin') {
			console.log(`✓ ${TARGET_EMAIL} ya es superadmin. Nada que hacer.`);
		} else {
			await users.updateOne({ _id: existing._id }, { $set: { role: 'superadmin' } });
			console.log(`✓ ${TARGET_EMAIL} ahora es superadmin.`);
		}
		await client.close();
		return;
	}

	console.log(`El usuario ${TARGET_EMAIL} no existe. Lo voy a crear con provider=credentials.`);
	const rl = readline.createInterface({ input, output });
	const username = (await rl.question('Nombre de usuario: ')).trim();
	const password = (await rl.question('Contraseña (mínimo 6 caracteres): ')).trim();
	rl.close();

	if (!username || password.length < 6) {
		console.error('✗ Datos inválidos. Username requerido y password >= 6 caracteres.');
		await client.close();
		process.exit(1);
	}

	const usernameTaken = await users.findOne({ username });
	if (usernameTaken) {
		console.error(`✗ El nombre de usuario "${username}" ya está en uso.`);
		await client.close();
		process.exit(1);
	}

	const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

	await users.insertOne({
		email: TARGET_EMAIL,
		username,
		passwordHash,
		createdAt: new Date(),
		provider: 'credentials',
		emailVerified: true,
		role: 'superadmin'
	});

	console.log(`✓ Superadmin creado: ${TARGET_EMAIL} (usuario: ${username})`);
	await client.close();
}

main().catch((err) => {
	console.error('✗ Error:', err);
	process.exit(1);
});
