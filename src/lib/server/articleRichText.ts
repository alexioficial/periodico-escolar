export function escapeArticleHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function renderLegacyArticleHtml(content: string): string {
	return escapeArticleHtml(content).replace(/\r\n?|\n/g, '<br>');
}

export interface ArticleRichTextMark {
	type: 'bold' | 'italic' | 'strike' | 'link';
	attrs?: Record<string, unknown>;
}

export type ArticleRichTextNodeType =
	| 'doc'
	| 'paragraph'
	| 'heading'
	| 'text'
	| 'hardBreak'
	| 'blockquote'
	| 'bulletList'
	| 'orderedList'
	| 'listItem';

export interface ArticleRichTextNode {
	type: ArticleRichTextNodeType;
	attrs?: Record<string, unknown>;
	content?: ArticleRichTextNode[];
	text?: string;
	marks?: ArticleRichTextMark[];
}

export interface StoredArticleRichText {
	version: 1;
	doc: ArticleRichTextNode;
}

export interface ValidatedArticleRichText extends StoredArticleRichText {
	text: string;
	html: string;
}

export const ARTICLE_RICH_TEXT_MAX_BYTES = 250_000;
export const ARTICLE_RICH_TEXT_MAX_NODES = 10_000;
export const ARTICLE_RICH_TEXT_MAX_DEPTH = 20;
export const ARTICLE_RICH_TEXT_MAX_TEXT = 50_000;
export const ARTICLE_LINK_MAX_LENGTH = 2_048;

const BLOCK_NODE_TYPES = new Set([
	'paragraph',
	'heading',
	'blockquote',
	'bulletList',
	'orderedList'
]);
const MARK_TYPES = new Set(['bold', 'italic', 'strike', 'link']);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
	const allowedSet = new Set(allowed);
	for (const key of Object.keys(value)) {
		if (!allowedSet.has(key)) throw new Error(`${label} contiene el atributo desconocido "${key}"`);
	}
}

function containsAsciiControl(value: string): boolean {
	return Array.from(value).some((character) => {
		const code = character.codePointAt(0) ?? 0;
		return code < 32 || code === 127;
	});
}

function normalizeHref(value: unknown): string {
	if (typeof value !== 'string') throw new Error('El enlace no contiene una URL válida');
	const href = value.trim();
	if (!href || href.length > ARTICLE_LINK_MAX_LENGTH || containsAsciiControl(href)) {
		throw new Error('El enlace no contiene una URL válida');
	}

	if (href.startsWith('/')) {
		if (href.startsWith('//') || href.includes('\\')) {
			throw new Error('El enlace interno debe ser una ruta relativa a la raíz');
		}
		return href;
	}

	let url: URL;
	try {
		url = new URL(href);
	} catch {
		throw new Error('El enlace no contiene una URL válida');
	}
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		!url.hostname ||
		url.username ||
		url.password
	) {
		throw new Error('El enlace usa un esquema o credenciales no permitidos');
	}
	return href;
}

function normalizeMark(value: unknown): ArticleRichTextMark {
	if (!isRecord(value) || typeof value.type !== 'string' || !MARK_TYPES.has(value.type)) {
		throw new Error('El texto contiene una marca desconocida');
	}
	if (value.type !== 'link') {
		assertOnlyKeys(value, ['type'], `La marca ${value.type}`);
		return { type: value.type as 'bold' | 'italic' | 'strike' };
	}

	assertOnlyKeys(value, ['type', 'attrs'], 'La marca link');
	if (!isRecord(value.attrs)) throw new Error('El enlace no contiene atributos válidos');
	// Tiptap incluye estos atributos de presentación en su JSON. Se aceptan
	// como entrada, pero nunca se persisten: el servidor impone target y rel.
	assertOnlyKeys(value.attrs, ['href', 'target', 'rel', 'class'], 'El enlace');
	return { type: 'link', attrs: { href: normalizeHref(value.attrs.href) } };
}

type ParentKind = 'root' | 'block' | 'inline' | 'list' | 'listItem';

function normalizeNode(
	value: unknown,
	parent: ParentKind,
	depth: number,
	counter: { nodes: number }
): ArticleRichTextNode {
	if (depth > ARTICLE_RICH_TEXT_MAX_DEPTH) {
		throw new Error(`El documento supera la profundidad máxima de ${ARTICLE_RICH_TEXT_MAX_DEPTH}`);
	}
	if (!isRecord(value) || typeof value.type !== 'string') {
		throw new Error('El documento contiene un nodo inválido');
	}
	counter.nodes += 1;
	if (counter.nodes > ARTICLE_RICH_TEXT_MAX_NODES) {
		throw new Error(`El documento supera los ${ARTICLE_RICH_TEXT_MAX_NODES} nodos`);
	}

	const type = value.type;
	if (parent === 'root' && type !== 'doc') throw new Error('La raíz debe ser un nodo doc');
	if (parent === 'block' && !BLOCK_NODE_TYPES.has(type)) {
		throw new Error(`El nodo ${type} no está permitido en un bloque`);
	}
	if (parent === 'inline' && !['text', 'hardBreak'].includes(type)) {
		throw new Error(`El nodo ${type} no está permitido dentro de texto`);
	}
	if (parent === 'list' && type !== 'listItem') {
		throw new Error('Las listas solo pueden contener elementos de lista');
	}
	if (parent === 'listItem' && !BLOCK_NODE_TYPES.has(type)) {
		throw new Error(`El elemento de lista contiene el nodo no permitido ${type}`);
	}

	switch (type) {
		case 'doc': {
			if (parent !== 'root') throw new Error('Un nodo doc solo puede aparecer en la raíz');
			assertOnlyKeys(value, ['type', 'content'], 'El nodo doc');
			if (!Array.isArray(value.content)) throw new Error('El nodo doc requiere contenido');
			return {
				type,
				content: value.content.map((child) => normalizeNode(child, 'block', depth + 1, counter))
			};
		}
		case 'paragraph': {
			assertOnlyKeys(value, ['type', 'content'], 'El párrafo');
			if (value.content !== undefined && !Array.isArray(value.content)) {
				throw new Error('El párrafo contiene contenido inválido');
			}
			return {
				type,
				...(value.content
					? {
							content: value.content.map((child) =>
								normalizeNode(child, 'inline', depth + 1, counter)
							)
						}
					: {})
			};
		}
		case 'heading': {
			assertOnlyKeys(value, ['type', 'attrs', 'content'], 'El encabezado');
			if (!isRecord(value.attrs)) throw new Error('El encabezado requiere nivel');
			assertOnlyKeys(value.attrs, ['level'], 'El encabezado');
			if (value.attrs.level !== 2 && value.attrs.level !== 3) {
				throw new Error('Solo se permiten encabezados H2 y H3');
			}
			if (value.content !== undefined && !Array.isArray(value.content)) {
				throw new Error('El encabezado contiene contenido inválido');
			}
			return {
				type,
				attrs: { level: value.attrs.level },
				...(value.content
					? {
							content: value.content.map((child) =>
								normalizeNode(child, 'inline', depth + 1, counter)
							)
						}
					: {})
			};
		}
		case 'text': {
			assertOnlyKeys(value, ['type', 'text', 'marks'], 'El nodo de texto');
			if (typeof value.text !== 'string') throw new Error('El nodo de texto es inválido');
			if (value.marks !== undefined && !Array.isArray(value.marks)) {
				throw new Error('Las marcas del texto son inválidas');
			}
			const marks = value.marks?.map(normalizeMark);
			if (marks && new Set(marks.map((mark) => mark.type)).size !== marks.length) {
				throw new Error('Una marca no puede repetirse en el mismo texto');
			}
			return { type, text: value.text, ...(marks?.length ? { marks } : {}) };
		}
		case 'hardBreak':
			assertOnlyKeys(value, ['type'], 'El salto de línea');
			return { type };
		case 'blockquote': {
			assertOnlyKeys(value, ['type', 'content'], 'La cita');
			if (!Array.isArray(value.content)) throw new Error('La cita requiere contenido');
			return {
				type,
				content: value.content.map((child) => normalizeNode(child, 'block', depth + 1, counter))
			};
		}
		case 'bulletList':
		case 'orderedList': {
			assertOnlyKeys(
				value,
				type === 'orderedList' ? ['type', 'attrs', 'content'] : ['type', 'content'],
				'La lista'
			);
			if (type === 'orderedList' && value.attrs !== undefined) {
				if (!isRecord(value.attrs)) throw new Error('Los atributos de la lista son inválidos');
				assertOnlyKeys(value.attrs, ['start', 'type'], 'La lista numerada');
				if (
					value.attrs.start !== undefined &&
					(!Number.isInteger(value.attrs.start) || (value.attrs.start as number) < 1)
				) {
					throw new Error('El inicio de la lista numerada es inválido');
				}
				if (
					value.attrs.type !== undefined &&
					value.attrs.type !== null &&
					!['1', 'a', 'A', 'i', 'I'].includes(String(value.attrs.type))
				) {
					throw new Error('El tipo de lista numerada es inválido');
				}
			}
			if (!Array.isArray(value.content) || value.content.length === 0) {
				throw new Error('La lista requiere elementos');
			}
			return {
				type,
				content: value.content.map((child) => normalizeNode(child, 'list', depth + 1, counter))
			};
		}
		case 'listItem': {
			assertOnlyKeys(value, ['type', 'content'], 'El elemento de lista');
			if (!Array.isArray(value.content) || value.content.length === 0) {
				throw new Error('El elemento de lista requiere contenido');
			}
			const content = value.content.map((child) =>
				normalizeNode(child, 'listItem', depth + 1, counter)
			);
			if (content[0]?.type !== 'paragraph') {
				throw new Error('El elemento de lista debe comenzar con un párrafo');
			}
			return { type, content };
		}
		default:
			throw new Error(`El tipo de nodo ${type} no está permitido`);
	}
}

function nodeText(node: ArticleRichTextNode): string {
	if (node.type === 'text') return node.text ?? '';
	if (node.type === 'hardBreak') return '\n';
	const separator = ['doc', 'blockquote', 'bulletList', 'orderedList', 'listItem'].includes(
		node.type
	)
		? '\n'
		: '';
	return (node.content ?? []).map(nodeText).join(separator);
}

function renderMarks(text: string, marks: ArticleRichTextMark[]): string {
	return marks.reduce((html, mark) => {
		switch (mark.type) {
			case 'bold':
				return `<strong>${html}</strong>`;
			case 'italic':
				return `<em>${html}</em>`;
			case 'strike':
				return `<s>${html}</s>`;
			case 'link': {
				const href = escapeArticleHtml(String(mark.attrs?.href ?? ''));
				return `<a href="${href}" target="_blank" rel="noopener noreferrer ugc nofollow">${html}</a>`;
			}
			default:
				return html;
		}
	}, text);
}

function renderNode(node: ArticleRichTextNode): string {
	if (node.type === 'text') {
		return renderMarks(escapeArticleHtml(node.text ?? ''), node.marks ?? []);
	}
	if (node.type === 'hardBreak') return '<br>';

	const children = (node.content ?? []).map(renderNode).join('');
	switch (node.type) {
		case 'doc':
			return children;
		case 'paragraph':
			return `<p>${children}</p>`;
		case 'heading':
			return `<h${String(node.attrs?.level)}>${children}</h${String(node.attrs?.level)}>`;
		case 'blockquote':
			return `<blockquote>${children}</blockquote>`;
		case 'bulletList':
			return `<ul>${children}</ul>`;
		case 'orderedList':
			return `<ol>${children}</ol>`;
		case 'listItem':
			return `<li>${children}</li>`;
		default:
			return children;
	}
}

export function validateArticleRichText(value: unknown): ValidatedArticleRichText {
	let serialized: string;
	try {
		serialized = JSON.stringify(value);
	} catch {
		throw new Error('El contenido enriquecido no es JSON válido');
	}
	if (!serialized) throw new Error('El contenido enriquecido es inválido');
	if (new TextEncoder().encode(serialized).byteLength > ARTICLE_RICH_TEXT_MAX_BYTES) {
		throw new Error(`El contenido enriquecido supera los ${ARTICLE_RICH_TEXT_MAX_BYTES} bytes`);
	}
	if (!isRecord(value)) throw new Error('El contenido enriquecido es inválido');
	assertOnlyKeys(value, ['version', 'doc'], 'El contenido enriquecido');
	if (value.version !== 1) throw new Error('La versión del contenido enriquecido no es compatible');

	const doc = normalizeNode(value.doc, 'root', 1, { nodes: 0 });
	const text = nodeText(doc);
	if (!text.trim()) throw new Error('El documento no contiene texto visible');
	if (Array.from(text).length > ARTICLE_RICH_TEXT_MAX_TEXT) {
		throw new Error(`El texto visible supera los ${ARTICLE_RICH_TEXT_MAX_TEXT} caracteres`);
	}
	return {
		version: 1,
		doc,
		text,
		html: renderNode(doc)
	};
}

export function renderArticleContent(content: string, contentRich?: StoredArticleRichText): string {
	return contentRich ? validateArticleRichText(contentRich).html : renderLegacyArticleHtml(content);
}

export function prepareArticleContent(
	content: unknown,
	contentRich?: unknown
): { content: string; contentRich?: StoredArticleRichText } {
	if (contentRich !== undefined) {
		const validated = validateArticleRichText(contentRich);
		return {
			content: validated.text,
			contentRich: { version: 1, doc: validated.doc }
		};
	}

	if (typeof content !== 'string') throw new Error('El contenido debe ser texto');
	const plain = content.trim();
	if (!plain) throw new Error('El contenido no puede estar vacío');
	if (Array.from(plain).length > ARTICLE_RICH_TEXT_MAX_TEXT) {
		throw new Error(`El contenido no puede superar los ${ARTICLE_RICH_TEXT_MAX_TEXT} caracteres`);
	}
	return { content: plain };
}

export function parseSubmittedArticleContent(
	content: unknown,
	contentRichJson: unknown
): { content: string; contentRich?: StoredArticleRichText } {
	if (contentRichJson === null || contentRichJson === undefined || contentRichJson === '') {
		return prepareArticleContent(content);
	}
	if (typeof contentRichJson !== 'string') {
		throw new Error('El contenido enriquecido debe enviarse como JSON');
	}
	if (new TextEncoder().encode(contentRichJson).byteLength > ARTICLE_RICH_TEXT_MAX_BYTES) {
		throw new Error(`El contenido enriquecido supera los ${ARTICLE_RICH_TEXT_MAX_BYTES} bytes`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(contentRichJson);
	} catch {
		throw new Error('El contenido enriquecido contiene JSON inválido');
	}
	return prepareArticleContent(content, parsed);
}

export function toArticleContentPresentation<
	T extends { content: string; contentRich?: StoredArticleRichText }
>(article: T): Omit<T, 'contentRich'> & { contentHtml: string } {
	const { contentRich, ...safeArticle } = article;
	return {
		...safeArticle,
		contentHtml: renderArticleContent(article.content, contentRich)
	};
}

export function stripClientArticleHtml<T extends object>(article: T): Omit<T, 'contentHtml'> {
	const safeArticle = { ...article } as T & { contentHtml?: unknown };
	delete safeArticle.contentHtml;
	return safeArticle;
}
