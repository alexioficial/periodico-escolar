import { type Db, ObjectId } from 'mongodb';
import { getDb } from './db';

const CATEGORIES_COLLECTION = 'categories';

export interface CategoryDoc {
    _id?: ObjectId;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt?: Date;
}

// Default categories
const DEFAULT_CATEGORIES = [
    { name: 'Noticias', slug: 'noticias' },
    { name: 'Deportes', slug: 'deportes' },
    { name: 'Cultura', slug: 'cultura' },
    { name: 'Opinión', slug: 'opinion' },
    { name: 'Entrevistas', slug: 'entrevistas' }
];

export async function ensureDefaultCategories() {
    const db = await getDb();
    const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);

    const count = await collection.countDocuments();
    if (count === 0) {
        await collection.insertMany(
            DEFAULT_CATEGORIES.map(cat => ({
                ...cat,
                createdAt: new Date()
            }))
        );
    }
}

export async function createCategory(name: string) {
    const db = await getDb();
    const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);

    // Check for duplicates
    const existing = await collection.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existing) {
        throw new Error('Ya existe una categoría con ese nombre');
    }

    const slug = name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const result = await collection.insertOne({
        name,
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
    const db = await getDb();
    const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);
    return collection.findOne({ _id: new ObjectId(id) });
}

export async function updateCategory(id: string, name: string) {
    const db = await getDb();
    const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);

    // Check for duplicates (excluding current)
    const existing = await collection.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: new ObjectId(id) }
    });

    if (existing) {
        throw new Error('Ya existe una categoría con ese nombre');
    }

    const slug = name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    await collection.updateOne(
        { _id: new ObjectId(id) },
        {
            $set: {
                name,
                slug,
                updatedAt: new Date()
            }
        }
    );
}

export async function deleteCategory(id: string) {
    const db = await getDb();

    // Check if category has articles
    const articlesCount = await db.collection('articles').countDocuments({
        categoryId: id
    });

    if (articlesCount > 0) {
        throw new Error(`No se puede eliminar esta categoría porque tiene ${articlesCount} artículo(s) asociado(s)`);
    }

    const collection = db.collection<CategoryDoc>(CATEGORIES_COLLECTION);
    await collection.deleteOne({ _id: new ObjectId(id) });
}

export async function countArticlesByCategory(categoryId: string) {
    const db = await getDb();
    return db.collection('articles').countDocuments({ categoryId });
}
