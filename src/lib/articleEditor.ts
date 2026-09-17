import { type Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { normalizeSafeUrl } from './trustedDomains';

const ArticleLink = Link.extend({
	addAttributes() {
		return Object.fromEntries(
			Object.entries(this.parent?.() ?? {}).filter(([name]) => name !== 'title')
		);
	}
});

export function articleEditorExtensions() {
	return [
		StarterKit.configure({
			heading: { levels: [2, 3] },
			code: false,
			codeBlock: false,
			horizontalRule: false,
			underline: false,
			link: false,
			trailingNode: false,
			hardBreak: { keepMarks: false }
		}),
		ArticleLink.configure({
			openOnClick: false,
			autolink: false,
			linkOnPaste: true,
			isAllowedUri: (url) => normalizeSafeUrl(url) !== null,
			HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer ugc nofollow' }
		}),
		Placeholder.configure({ placeholder: 'Escribe aquí tu artículo…' })
	];
}

export function serializeArticleEditor(editor: Editor) {
	function normalize(node: JSONContent): JSONContent {
		if (node.type === 'hardBreak') return { type: 'hardBreak' };
		return { ...node, ...(node.content ? { content: node.content.map(normalize) } : {}) };
	}
	return { version: 1 as const, doc: normalize(editor.getJSON()) };
}

export function clearArticleEditor(editor: Editor) {
	editor.commands.clearContent();
}

export function applyArticleLink(editor: Editor, value: string, label = ''): boolean {
	const href = normalizeSafeUrl(value);
	if (!href) return false;
	if (editor.state.selection.empty && !editor.isActive('link')) {
		return editor.commands.insertContent({
			type: 'text',
			text: label.trim() || href,
			marks: [{ type: 'link', attrs: { href } }]
		});
	}
	return editor.chain().extendMarkRange('link').setLink({ href }).run();
}
