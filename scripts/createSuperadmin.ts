import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
	const uri = process.env.MONGODB_URI;
	const dbName = process.env.MONGODB_DB ?? 'periodico_escolar';
	const cliEmail = process.argv.slice(2).find((value) => value !== '--');
	const targetEmail = (cliEmail ?? process.env.SUPERADMIN_EMAIL ?? '').trim().toLowerCase();

	if (!uri) {
		console.error('✗ MONGODB_URI no está definida en .env');
		process.exit(1);
	}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
		console.error('✗ Indica un correo válido como argumento o en SUPERADMIN_EMAIL.');
		process.exit(1);
	}

	const client = new MongoClient(uri);
	await client.connect();
	const db = client.db(dbName);
	const users = db.collection('users');

	const existing = await users.findOne({ email: targetEmail });

	if (existing) {
		if (existing.role === 'superadmin') {
			console.log(`✓ ${targetEmail} ya es superadmin. Nada que hacer.`);
		} else {
			await users.updateOne({ _id: existing._id }, { $set: { role: 'superadmin' } });
			console.log(`✓ ${targetEmail} ahora es superadmin.`);
		}
		await client.close();
		return;
	}

	// El flujo de login es magic-link / Google: la cuenta se materializa al
	// primer inicio de sesión. Acá solo ascendemos a superadmin a un usuario
	// existente — si no existe, primero hay que loguearse al menos una vez.
	console.error(
		`✗ El usuario ${targetEmail} no existe todavía. Inicia sesión una vez (magic-link o Google) y volvé a correr el script.`
	);
	await client.close();
	process.exit(1);
}

main().catch((err) => {
	console.error('✗ Error:', err);
	process.exit(1);
});
