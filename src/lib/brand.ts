export const BRAND_NAME = 'SANTO DOMINGO SAVIO';
export const BRAND_SUBTITLE = 'Periódico Escolar Salesiano';

const BRAND_TITLE_NAME = 'Santo Domingo Savio';

export function brandTitle(section?: string): string {
	return section ? `${section} · ${BRAND_TITLE_NAME}` : `${BRAND_TITLE_NAME} · ${BRAND_SUBTITLE}`;
}
