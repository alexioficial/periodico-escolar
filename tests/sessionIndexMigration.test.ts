import assert from 'node:assert/strict';
import test from 'node:test';

interface MigrationModule {
	migrateLegacySessions(collection: unknown): Promise<void>;
}

async function loadMigrationModule(): Promise<MigrationModule> {
	try {
		return (await import('../src/lib/server/sessionIndexMigration.ts')) as unknown as MigrationModule;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw error;
		return { migrateLegacySessions: async () => {} };
	}
}

test('elimina token_1 antes de migrar sesiones al hash', async () => {
	const module = await loadMigrationModule();
	let legacyIndexPresent = true;
	let bulkWriteRan = false;
	let operations: unknown[] = [];

	const collection = {
		async indexes() {
			return [
				{ name: '_id_', key: { _id: 1 }, unique: true },
				{ name: 'token_1', key: { token: 1 }, unique: true }
			];
		},
		async dropIndex(name: string) {
			assert.equal(name, 'token_1');
			legacyIndexPresent = false;
		},
		find() {
			return {
				async toArray() {
					return [
						{ _id: 'session-a', token: 'legacy-token-a' },
						{ _id: 'session-b', token: 'legacy-token-b' }
					];
				}
			};
		},
		async bulkWrite(nextOperations: unknown[]) {
			if (legacyIndexPresent) throw new Error('E11000 duplicate key token: null');
			bulkWriteRan = true;
			operations = nextOperations;
		}
	};

	await module.migrateLegacySessions(collection);

	assert.equal(legacyIndexPresent, false);
	assert.equal(bulkWriteRan, true);
	assert.deepEqual(operations[0], {
		updateOne: {
			filter: { _id: 'session-a', token: 'legacy-token-a' },
			update: {
				$set: {
					tokenHash: 'e5fc4d0932b4df2d1079df1b817fe762696ab57b5fff8bc0c9e980ca6883482e'
				},
				$unset: { token: '' }
			}
		}
	});
});

test('tolera una base nueva sin colección de sesiones', async () => {
	const module = await loadMigrationModule();
	let findRan = false;

	const collection = {
		async indexes() {
			throw Object.assign(new Error('NamespaceNotFound'), { code: 26 });
		},
		async dropIndex() {
			assert.fail('No debe intentar eliminar índices inexistentes');
		},
		find() {
			findRan = true;
			return { toArray: async () => [] };
		},
		async bulkWrite() {
			assert.fail('No debe migrar sesiones inexistentes');
		}
	};

	await module.migrateLegacySessions(collection);

	assert.equal(findRan, true);
});
