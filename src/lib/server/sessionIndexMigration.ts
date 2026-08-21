import crypto from 'node:crypto';
import type { Collection, ObjectId } from 'mongodb';

interface LegacySessionDoc {
	_id: ObjectId;
	token: string;
}

async function listIndexesOrEmpty(sessions: Collection) {
	try {
		return await sessions.indexes();
	} catch (error) {
		if ((error as { code?: number }).code === 26) return [];
		throw error;
	}
}

export async function migrateLegacySessions(sessions: Collection): Promise<void> {
	const indexes = await listIndexesOrEmpty(sessions);
	if (indexes.some((index) => index.name === 'token_1')) {
		await sessions.dropIndex('token_1');
	}

	const legacySessions = await sessions
		.find<LegacySessionDoc>({ token: { $type: 'string' } }, { projection: { token: 1 } })
		.toArray();
	if (legacySessions.length === 0) return;

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
