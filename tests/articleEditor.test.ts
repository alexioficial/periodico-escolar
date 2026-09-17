import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Editor } from '@tiptap/core';
import { validateArticleRichText } from '../src/lib/server/articleRichText.ts';

test('el editor real conserva formatos permitidos y genera JSON aceptado por el servidor', async () => {
	const helpers = await import('../src/lib/articleEditor.ts');
	const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://paper.test' });
	for (const key of [
		'window',
		'document',
		'navigator',
		'HTMLElement',
		'Element',
		'Node',
		'MutationObserver',
		'getComputedStyle'
	])
		Object.defineProperty(globalThis, key, {
			configurable: true,
			value: (dom.window as unknown as Record<string, unknown>)[key]
		});
	const editor = new Editor({
		element: document.createElement('div'),
		extensions: helpers.articleEditorExtensions(),
		content:
			'<h2>Título</h2><h3>Sección</h3><p><strong>Fuerte</strong><em>Suave</em><s>Tachado</s><br>Otra línea <a href="/feed">Interno</a></p><blockquote><p>Cita</p></blockquote><ul><li>Uno</li></ul><ol><li>Dos</li></ol>'
	});
	try {
		const result = validateArticleRichText(helpers.serializeArticleEditor(editor));
		for (const tag of ['h2', 'h3', 'strong', 'em', 's', 'br', 'blockquote', 'ul', 'ol', 'a'])
			assert.match(result.html, new RegExp(`<${tag}[ >]`));
		editor.commands.setContent(
			'<p><strong style="color:red;font-family:evil">Permitido</strong><u>Subrayado</u><code>Código</code><img src="bad"><script>alert(1)</script></p><table><tr><td>Celda</td></tr></table><pre>Bloque</pre>'
		);
		const pasted = validateArticleRichText(helpers.serializeArticleEditor(editor));
		assert.match(pasted.html, /<strong>Permitido<\/strong>/);
		assert.doesNotMatch(
			pasted.html,
			/style|font-family|<img|<script|<code|<pre|<table|<u>|alert\(1\)/
		);
		editor.commands.setContent('<p>Texto</p>');
		editor.commands.setTextSelection({ from: 1, to: 6 });
		assert.equal(helpers.applyArticleLink(editor, 'https://example.com'), true);
		assert.match(
			validateArticleRichText(helpers.serializeArticleEditor(editor)).html,
			/<a href="https:\/\/example.com\//
		);
		assert.equal(helpers.applyArticleLink(editor, 'javascript:alert(1)'), false);
		helpers.clearArticleEditor(editor);
		assert.equal(editor.getText(), '');
		assert.equal(helpers.applyArticleLink(editor, '/feed', 'Inicio'), true);
		assert.match(
			validateArticleRichText(helpers.serializeArticleEditor(editor)).html,
			/>Inicio<\/a>/
		);
	} finally {
		editor.destroy();
		dom.window.close();
	}
});
