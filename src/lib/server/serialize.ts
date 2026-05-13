/**
 * Convierte un valor (con ObjectId, Date, etc.) en su forma JSON-safe plana
 * para enviar desde un loader de SvelteKit al cliente. Mantiene el tipado.
 */
export function serialize<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
