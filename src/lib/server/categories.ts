import { ObjectId } from 'mongodb';
import { getDb } from './db';

const CATEGORIES_COLLECTION = 'categories';

export interface CategoryDoc {
	_id?: ObjectId;
	name: string;
	slug: string;
	createdAt: Date;
	updatedAt?: Date;
}

const DEFAULT_CATEGORIES = [
	{ name: 'Noticias', slug: 'noticias' },
	{ name: 'Deportes', slug: 'deportes' },
	{ name: 'Cultura', slug: 'cultura' },
	{ name: 'Opinión', slug: 'opinion' },
	{ name: 'Entrevistas', slug: 'entrevistas' }
];

const NAME_MIN = 1;
const NAME_MAX = 50;

// Sin escape, un name con metacaracteres regex (.*, .+, etc.) puede causar
// ReDoS y/o saltar la detección de duplicados ("." matchearía cualquier letra).
function escapeRegex(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(name: string) {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normalizeName(name: string): string {
	if (typeof name !== 'string') {
		throw new Error('Nombre de categoría inválido');
	}
	const trimmed = name.trim();
	if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
		throw new Error(
			`El nombre de la categoría debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres`
		);
	}
	return trimmed;
}

export async function ensureDefaultCategories() {
	const db = await getDb();
	const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);

	const count = await collection.countDocuments();
	if (count === 0) {
		await collection.insertMany(
			DEFAULT_CATEGORIES.map((cat) => ({
				...cat,
				createdAt: new Date()
			}))
		);
	}
}

export async function createCategory(name: string) {
	const clean = normalizeName(name);
	const db = await getDb();
	const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);

	const existing = await collection.findOne({
		name: { $regex: new RegExp(`^${escapeRegex(clean)}$`, 'i') }
	});

	if (existing) {
		throw new Error('Ya existe una categoría con ese nombre');
	}

	const slug = slugify(clean);
	if (!slug) {
		throw new Error('El nombre de la categoría no produce un slug válido');
	}

	const result = await collection.insertOne({
		name: clean,
		slug,
		createdAt: new Date()
	});

	return result.insertedId;
}

export async function getCategories() {
	const db = await getDb();
	const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);
	return collection.find({}).sort({ name: 1 }).toArray();
}

export async function getCategoryById(id: string) {
	if (typeof id !== 'string' || !ObjectId.isValid(id)) return null;
	const db = await getDb();
	const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);
	return collection.findOne({ _id: new ObjectId(id) });
}

export async function updateCategory(id: string, name: string) {
	if (typeof id !== 'string' || !ObjectId.isValid(id)) {
		throw new Error('La categoría indicada no es válida');
	}
	const clean = normalizeName(name);
	const db = await getDb();
	const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);

	const existing = await collection.findOne({
		name: { $regex: new RegExp(`^${escapeRegex(clean)}$`, 'i') },
		_id: { $ne: new ObjectId(id) }
	});

	if (existing) {
		throw new Error('Ya existe una categoría con ese nombre');
	}

	const slug = slugify(clean);
	if (!slug) {
		throw new Error('El nombre de la categoría no produce un slug válido');
	}

	await collection.updateOne(
		{ _id: new ObjectId(id) },
		{
			$set: {
				name: clean,
				slug,
				updatedAt: new Date()
			}
		}
	);
}

export async function deleteCategory(id: string) {
	if (typeof id !== 'string' || !ObjectId.isValid(id)) {
		throw new Error('La categoría indicada no es válida');
	}
	const db = await getDb();

	const articlesCount = await db.collection('articles').countDocuments({
		categoryId: id
	});

	if (articlesCount > 0) {
		throw new Error(
			`No se puede eliminar esta categoría porque tiene ${articlesCount} artículo(s) asociado(s)`
		);
	}

	const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);
	await collection.deleteOne({ _id: new ObjectId(id) });
}

export async function countArticlesByCategory(categoryId: string) {
	if (typeof categoryId !== 'string') return 0;
	const db = await getDb();
	return db.collection('articles').countDocuments({ categoryId });
}
