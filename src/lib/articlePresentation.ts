const articleDateFormatter = new Intl.DateTimeFormat('es', {
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	timeZone: 'America/La_Paz'
});

export function formatArticleDate(value: string | Date | null | undefined): string {
	if (!value) return '';
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? '' : articleDateFormatter.format(date);
}

export function articleImageAlt(title: string, index: number, total: number): string {
	const cleanTitle = title.trim() || 'Sin título';
	return total > 1
		? `Imagen ${index + 1} de ${total} del artículo «${cleanTitle}»`
		: `Imagen del artículo «${cleanTitle}»`;
}
