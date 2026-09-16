type MigrationCollection = {
	updateMany(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<unknown>;
};

export async function migrateArticleEngagement(collection: MigrationCollection): Promise<void> {
	await collection.updateMany({ likes: { $exists: true } }, { $unset: { likes: '' } });
	await collection.updateMany({ views: { $exists: false } }, { $set: { views: 0 } });
}
